import { } from '@hieuzest/koishi-plugin-im'
import { Context } from '@koishijs/client'
import './icons'
import Layout from './layout.vue'

export default (ctx: Context) => {
  ctx.page({
    name: 'IM',
    path: '/im',
    icon: 'activity:im',
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
