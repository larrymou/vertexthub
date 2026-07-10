// packages/core/src/demo/mock-demo.test.ts
// Mock Demo 测试

import { describe, it, expect } from 'vitest'
import { runMockDemo } from './mock-demo'

describe('MockDemo', () => {
  it('should run without errors', async () => {
    // 捕获 console.log 输出
    const logs: string[] = []
    const originalLog = console.log
    console.log = (...args) => logs.push(args.join(' '))

    try {
      await runMockDemo()
      
      // 验证关键步骤都执行了
      const output = logs.join('\n')
      expect(output).toContain('Step 1')
      expect(output).toContain('Step 2')
      expect(output).toContain('Step 3')
      expect(output).toContain('Step 4')
      expect(output).toContain('Step 5')
      expect(output).toContain('Step 6')
      expect(output).toContain('Mock Demo completed')
    } finally {
      console.log = originalLog
    }
  })
})
