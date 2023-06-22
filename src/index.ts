import { } from '@koishijs/plugin-auth'
import { Client, Console, DataService, Events } from '@koishijs/plugin-console'
import { Context, Dict, Schema } from 'koishi'
import { resolve } from 'path'

declare module 'koishi' {
  interface Tables {
    'im/messages': IM.Message
  }
}

declare module '@koishijs/plugin-console' {
  export interface Events {
    'im/select'(targetId: number): Promise<number>
    'im/send'(targetId: number, content: string): Promise<number>
    'im/read'(...messageIds: number[]): Promise<number>
    'im/delete'(...messageIds: number[]): Promise<number>

    'im/notify'(): void
  }

  namespace Console {
    interface Services {
      'im/targets': DataService<IM.Target[]>
      'im/current': DataService<IM.Message[]>
    }
  }
}

export class IM {
  static using = ['console', 'database'] as const

  // Token -> Session
  sessions: Dict<IM.Session> = {}

  constructor(private ctx: Context, private config: IM.Config) {
    const im = this as IM

    // ctx.model.drop('im/messages')

    ctx.model.extend('im/messages', {
      id: 'unsigned',
      userId: 'unsigned',
      username: 'string',
      targetId: 'unsigned',
      targetName: 'string',
      sentAt: 'timestamp',
      read: 'boolean',
      deleted: 'boolean',
      content: 'text'
    }, {
      autoInc: true
    })

    ctx.console.addListener('im/select', async function onSelect(targetId: number) {
      const caller = this as Client
      if (!caller.auth) return -2
      im.sessions[caller.auth.token] = {
        current: targetId
      }
      // await im.ctx.database.set('im/messages', { userId: targetId, targetId: caller.auth.id }, {
      //   read: true
      // })

      im.sendTo(caller, 'data', 'im/current', await im.getMessages(caller.auth.id, targetId))
      return 0
    })

    ctx.console.addListener('im/send', async function onSend(targetId: number, content: string) {
      const caller = this as Client
      if (!caller.auth) return -2
      new Promise(async _ => {
        const target = await im.ctx.database.get('user', targetId, ['name'])
        if (!target) return
        const message = await im.ctx.database.create('im/messages', {
          content: content,
          userId: caller.auth.id,
          username: caller.auth.name || `@${caller.auth.id}`,
          targetId: targetId,
          targetName: target[0].name || `@${targetId}`,
          sentAt: new Date(),
          read: false,
          deleted: false,
        })
        im.send(targetId, 'patch', 'im/current', [message], (session) => session.current === caller.auth.id)
        im.send(caller.auth.id, 'patch', 'im/current', [message], (session) => session.current === targetId)
        im.send(targetId, 'data', 'im/targets', Object.values(await im.getTargets(targetId)))
        im.send(caller.auth.id, 'data', 'im/targets', Object.values(await im.getTargets(caller.auth.id)))
      })
      return 0
    })

    ctx.console.addListener('im/read', async function onRead(...messageIds: number[]) {
      const caller = this as Client
      if (!caller.auth) return -2
      await im.ctx.database.set('im/messages', messageIds, {
        read: true
      })
      return 0
    })

    ctx.console.addListener('im/delete', async function onDelete(...messageIds: number[]) {
      const caller = this as Client
      if (!caller.auth) return -2
      const ret = await im.ctx.database.set('im/messages', {
        id: {
          $in: messageIds
        }
      }, {
        deleted: true
      })
      console.log(ret)
      return 0
    })

    ctx.on('console/connection', async (client) => {
      if (!client.auth) return
      im.sendTo(client, 'data', 'im/targets', await im.getTargets(client.auth.id))
      im.sendTo(client, 'data', 'im/current', [])
      this.emitTo(client, 'im/notify')
    })

    ctx.on('ready', () => {
      Object.values(ctx.console.clients).map(client => this.emitTo(client, 'im/notify'))
    })

    ctx.console.addEntry({
      dev: resolve(__dirname, '../client/index.ts'),
      prod: resolve(__dirname, '../dist'),
    })

  }

  send<K extends keyof Console.Services>(targetId: number, type: IM.PayloadType, key: K, 
    value: Console.Services[K] extends DataService<infer T> ? T : never,
    predicate?: (session?: IM.Session) => boolean) {
    if (!Object.keys(this.sessions).length) return
    const data = { type, body: { key, value } }
    let flag = false
    for (const client of Object.values(this.ctx.console.clients)) {
      if (client.auth && client.auth.id === targetId && 
        (!predicate || predicate(this.sessions[client.auth.token]))) {
        client.send(data)
        flag = true
      }
    }
    return flag
  }

  sendTo<K extends keyof Console.Services>(client: Client, type: IM.PayloadType, key: K, 
    value: Console.Services[K] extends DataService<infer T> ? T : never) {
    const data = { type, body: { key, value } }
    client.send(data)
    return true
  }

  emitTo<K extends keyof Events>(client: Client, key: K, ...args: Parameters<Events[K]>) {
    const data = { type: key, body: args }
    client.send(data)
    return true
  }

  async getTargets(targetId: number) {
    const targetedMessages = await this.ctx.database.get('im/messages', {
      $or: [
        { targetId: targetId },
        { userId: targetId }
      ],
      deleted: false,
    })

    const targets: Dict<IM.Target> = {}
    for (const message of targetedMessages) {
      let otherId = message.targetId === targetId ? message.userId : message.targetId
      let otherName = message.targetId === targetId ? message.username : message.targetName
      if (!(otherId in targets))
        targets[otherId] = {
          userId: otherId,
          username: otherName,
          unreadCount: 0,
          lastTime: message.sentAt,
        }
      if (message.targetId === targetId && !message.read) targets[otherId].unreadCount ++
      targets[otherId].lastTime = message.sentAt
    }

    const targetList = Object.values(targets).sort(IM.cmpTarget).reverse()
    const users = await this.ctx.database.get('user', {}, ['id', 'name'])

    for (const user of users)
      if (!(user.id in targets)) targetList.push({
        userId: user.id,
        username: user.name || `@${user.id}`,
        unreadCount: 0,
        lastTime: null
      })

    return targetList
  }

  async getMessages(userId: number, targetId: number) {
    return (await this.ctx.database.get('im/messages', {
      $or: [
        {
          userId: userId,
          targetId: targetId,
        },
        {
          userId: targetId,
          targetId: userId,
        },
      ],
      deleted: false,
    })).sort(IM.cmpMessage)
  }
}

export namespace IM {
    
  export interface Session {
    current: number
  }

  export interface Target {
    userId: number
    username: string
    unreadCount: number
    lastTime?: Date
  }

  export interface Message {
    id: number
    content: string
    userId: number
    username: string
    targetId: number
    targetName: string
    sentAt: Date
    read: boolean
    deleted: boolean
  }

  export const cmpMessage = (a: Message, b: Message) => a.sentAt.getTime() - b.sentAt.getTime()
  export const cmpTarget = (a: Target, b: Target) => a.lastTime.getTime() - b.lastTime.getTime()

  export type PayloadType = 'data' | 'patch'

  export interface Config {}

  export const Config: Schema<Config> = Schema.object({})

}

export default IM
