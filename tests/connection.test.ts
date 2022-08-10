import Db from '../src/index'

jest.setTimeout(10000)
test('should connect', async () => {
    const db = await Db.get()
    expect( !!db ).toBe(true)
})