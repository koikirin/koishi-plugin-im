import { Context } from '@koishijs/client'
import { } from 'koishi-plugin-im'
import Layout from './layout.vue'

export default (ctx: Context) => {
  ctx.page({
    name: 'IM',
    path: '/im',
    fields: ['im/targets', 'im/current'],
    component: Layout,
  })

  ctx.menu('im.message', [{
    id: '.delete',
    label: '删除消息',
  }, {
    id: '.clear',
    label: '清空全部',
  }])
}
