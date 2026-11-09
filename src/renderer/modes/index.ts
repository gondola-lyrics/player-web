import type { DomRendererMode } from '../config'
import type { RenderContext } from '../context'
import type { RenderMode } from './types'

import { ListMode } from './list/mode'

/**
 * Always creates a fresh instance, so layout state cannot leak across mode switches.
 */
export const createMode = (mode: DomRendererMode, context: RenderContext): RenderMode => {
  switch (mode) {
    case 'list':
      return new ListMode(context)
    default:
      throw new RangeError(`Unsupported renderer mode: ${mode}`)
  }
}
