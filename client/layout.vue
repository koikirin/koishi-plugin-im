<template>
  <k-layout class="page-sandbox">
    <template #left>
      <div class="user-container">
        <el-scrollbar>
          <k-tab-group :data="store['im/targets']" v-model="config.targetIndex" #="{ username }">
            <div class="avatar">{{ username[0] }}</div>
            <div class="nick">{{ username }}</div>
          </k-tab-group>
        </el-scrollbar>
      </div>
    </template>

    <!-- <div class="card-header">
      <template v-for="(name, key) in panelTypes" :key="key">
        <span class="k-horizontal-tab-item"
          :class="{ active: config.panelType === key }"
          @click="config.panelType = key">{{ name }}</span>
      </template>
    </div> -->

    <keep-alive>
      <k-empty key="empty" v-if="!store['im/targets'].length">
        <div>当前系统中没有用户哦</div>
      </k-empty>
      <!-- <k-content :key="'profile' + channel" v-else-if="config.panelType === 'profile'">
      </k-content> -->
      <template v-else>
        <virtual-list :data="store['im/current']" #="data" pinned>
          <chat-message :data="data"></chat-message>
        </virtual-list>
        <div class="card-footer">
          <chat-input v-model="input" @send="sendMessage" placeholder="发送消息"></chat-input>
        </div>
      </template>
    </keep-alive>
  </k-layout>
</template>

<script lang="ts" setup>
import { IM } from '@hieuzest/koishi-plugin-im';
import { ChatInput, VirtualList, receive, router, send, store, useContext } from '@koishijs/client';
import { ElNotification } from 'element-plus';
import { ref, watch } from 'vue';
import ChatMessage from './message.vue';
import { config } from './utils';

const ctx = useContext()

ctx.action('im.message.delete', {
  action: (event) => send('im/delete', event.im.message.id).then(select)
})

ctx.action('im.message.clear', {
  action: (event) => send('im/delete', ...store['im/current'].map(x => x.id)).then(select)
})

const input = ref('')

function current() {
  return store['im/targets'][config.value.targetIndex]?.userId ?? -1
}

function select() {
  send('im/select', config.value.targetId)
}

receive('im/notify', select)

watch(() => config.value.targetIndex, (value) => {
  config.value.targetId = current()
  select()
}, { immediate: true })


select()

watch(() => store['im/targets'], (value) => {
  config.value.targetIndex = value.findIndex(x => x.userId === config.value.targetId)
})

function sendMessage(content: string) {
  send('im/send', current(), content)
}

receive('im/message', (args) => {
  const [message]: IM.Message[] = args
  if (message.userId === current()) {
    store['im/current'].push(message)
  }
  if (router.currentRoute.value.name != 'im' || message.userId !== current())
    ElNotification({
      title: `来自${message.username}的消息`, message: message.content,
      position: 'bottom-right',
    })
})

</script>

<style lang="scss">

.page-sandbox {
  --avatar-size: 2.5rem;

  aside, main {
    display: flex;
    flex-direction: column;
  }

  .avatar {
    border-radius: 100%;
    background-color: var(--primary);
    transition: 0.3s ease;
    width: var(--avatar-size);
    height: var(--avatar-size);
    line-height: var(--avatar-size);
    font-size: 1.25rem;
    text-align: center;
    font-weight: 400;
    color: #fff;
    font-family: Comic Sans MS;
    user-select: none;
  }

  .card-header {
    text-align: center;
    font-weight: bold;
    font-size: 1.15rem;
    padding: 1rem 0;
    border-bottom: 1px solid var(--k-color-divider);
  }

  .card-footer {
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--k-color-divider);

    .quote {
      opacity: 0.5;
      font-size: 14px;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;

      .k-icon {
        cursor: pointer;
      }
    }
  }

  .user-container {
    overflow-y: auto;
  }

  .k-tab-item {
    padding: 0.75rem 1.5rem;
    display: flex;
    border-bottom: 1px solid var(--k-color-divider);

    > .nick {
      line-height: 2.5rem;
      margin-left: 1.25rem;
      font-weight: 500;
      flex-grow: 1;
    }

    > .close {
      opacity: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      transition: opacity 0.3s ease;
      color: var(--fg1);
    }

    &:hover > .close {
      opacity: 0.5;
      &:hover {
        opacity: 1;
      }
    }
  }
}

.message-context-menu {
  position: fixed;
  z-index: 1000;
  min-width: 12rem;
  padding: 0.5rem 0;
  border-radius: 4px;
  background-color: var(--k-card-bg);
  box-shadow: var(--k-card-shadow);
  transition: var(--color-transition);
  font-size: 14px;

  .item {
    user-select: none;
    padding: 0.25rem 1.5rem;
    cursor: pointer;
    transition: var(--color-transition);

    &:hover {
      background-color: var(--k-hover-bg);
    }
  }
}

</style>
