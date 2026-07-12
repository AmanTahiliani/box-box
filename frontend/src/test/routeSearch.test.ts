import { describe, it, expect } from 'vitest'
import { parseRaceHubSearch, parseWeekendSearch, weekendFocusSearch } from '../lib/routeSearch'

describe('routeSearch', () => {
  it('parses positive weekend meeting/session keys and drops invalid values', () => {
    expect(parseWeekendSearch({ meeting_key: '1229', session_key: '9000' })).toEqual({
      meeting_key: 1229,
      session_key: 9000,
    })
    expect(parseWeekendSearch({ meeting_key: '0', session_key: '-1', foo: 'bar' })).toEqual({})
    expect(parseWeekendSearch({})).toEqual({})
  })

  it('parses race-hub session keys', () => {
    expect(parseRaceHubSearch({ session_key: '9472' })).toEqual({ session_key: 9472 })
    expect(parseRaceHubSearch({ session_key: 'nope' })).toEqual({})
  })

  it('builds Weekend focus search for Race Hub returns', () => {
    expect(weekendFocusSearch(1229, 9000)).toEqual({ meeting_key: 1229, session_key: 9000 })
    expect(weekendFocusSearch(null, 9000)).toEqual({ session_key: 9000 })
    expect(weekendFocusSearch(1229, undefined)).toEqual({ meeting_key: 1229 })
  })
})
