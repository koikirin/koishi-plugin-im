import { useStorage } from '@koishijs/client';
import type { RemovableRef } from '@vueuse/core';
import type { Dict } from 'koishi';
import { IM } from 'koishi-plugin-im';

declare module '@koishijs/client' {
  interface ActionContext {
    'im.message': IM.Message
  }
}

interface IMConfig {
  targetIndex: number,
  targetId: number,
  index: number
  messages: Dict<IM.Message[]>
}

export const config: RemovableRef<IMConfig> = useStorage<IMConfig>('im', 1.1, () => ({
  targetIndex: -1,
  targetId: -1,
  index: 0,
  messages: {},
}))
