import { POST } from './route'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fetch globally
global.fetch = vi.fn()

describe('POST /api/agent', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()
  })

  it('returns 400 when message is missing', async () => {
    const request = new Request('http://localhost/api/agent', {
      method: 'POST',
      body: JSON.stringify({ agent_id: 'test-agent' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Message and agent_id are required')
  })

  it('returns 400 when agent_id is missing', async () => {
    const request = new Request('http://localhost/api/agent', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Message and agent_id are required')
  })

  it('successfully calls AI agent and returns parsed response', async () => {
    // Mock successful AI agent response
    const mockResponse = {
      response: JSON.stringify({
        success: true,
        result: 'Test response',
      }),
      agent_id: 'test-agent',
      user_id: 'user-123',
      session_id: 'session-456',
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const request = new Request('http://localhost/api/agent', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Hello AI',
        agent_id: 'test-agent',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.response).toEqual({ success: true, result: 'Test response' })
    expect(data.agent_id).toBe('test-agent')
    expect(data.user_id).toBe('user-123')
    expect(data.session_id).toBe('session-456')
  })

  it('handles AI agent API errors gracefully', async () => {
    // Mock API error
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    })

    const request = new Request('http://localhost/api/agent', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Hello AI',
        agent_id: 'test-agent',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toContain('AI Agent API error')
  })

  it('handles malformed JSON from AI agent', async () => {
    // Mock response with invalid JSON
    const mockResponse = {
      response: 'This is not valid JSON {broken',
      agent_id: 'test-agent',
      user_id: 'user-123',
      session_id: 'session-456',
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const request = new Request('http://localhost/api/agent', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Hello AI',
        agent_id: 'test-agent',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    // Should return raw string when parsing fails
    expect(data.response).toBe('This is not valid JSON {broken')
  })

  it('passes optional parameters to AI agent', async () => {
    const mockResponse = {
      response: JSON.stringify({ result: 'ok' }),
      agent_id: 'test-agent',
      user_id: 'custom-user',
      session_id: 'custom-session',
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const request = new Request('http://localhost/api/agent', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Hello',
        agent_id: 'test-agent',
        user_id: 'custom-user',
        session_id: 'custom-session',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    await POST(request)

    // Verify fetch was called with correct parameters
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('custom-user'),
      })
    )
  })
})
