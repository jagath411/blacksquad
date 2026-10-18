import { searchPlaces } from '../services/geocodingService';

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

describe('place search', () => {
  it('waits for three characters before searching', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;
    expect(await searchPlaces('in')).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('splits results into a short title and the rest of the address', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { lat: '12.97', lon: '77.64', name: 'Indiranagar', display_name: 'Indiranagar, Bengaluru, Karnataka, 560038, India' },
        { lat: 'bad', lon: '77.6', display_name: 'Broken row' },
      ],
    }) as unknown as typeof fetch;
    const places = await searchPlaces('Indira', { latitude: 12.97, longitude: 77.59 });
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({ title: 'Indiranagar', subtitle: 'Bengaluru, Karnataka, 560038', coordinates: [77.64, 12.97] });
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('viewbox=');
  });
});
