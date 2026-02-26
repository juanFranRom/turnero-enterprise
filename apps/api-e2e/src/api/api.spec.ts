import axios from 'axios';

describe('GET /api', () => {
  it('should return a message', async () => {
    const baseURL = process.env.NX_BASE_URL ?? 'http://localhost:3000';
    const client = axios.create({ baseURL });

    const res = await client.get('/api/health');

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ message: 'Hello API' });
  });
});