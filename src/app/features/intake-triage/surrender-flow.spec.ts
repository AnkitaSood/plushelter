import { surrenderToPhotosPendingAnimal } from './surrender-flow';
import { PHOTOS_PENDING_PLACEHOLDER } from '../../data/roster';
import { EMPTY_SURRENDER_REQUEST, type SurrenderRequest } from './surrender-request.model';

function request(overrides: Partial<SurrenderRequest> = {}): SurrenderRequest {
  return { ...EMPTY_SURRENDER_REQUEST, ...overrides };
}

describe('surrenderToPhotosPendingAnimal', () => {
  it('maps animal name, species, and condition through unchanged', () => {
    const animal = surrenderToPhotosPendingAnimal(
      request({ animalName: 'Mr. Whiskers', species: 'Octopus', condition: 'One tentacle loose' }),
    );
    expect(animal.name).toBe('Mr. Whiskers');
    expect(animal.species).toBe('Octopus');
    expect(animal.condition).toBe('One tentacle loose');
  });

  it('marks the animal photos-pending, unavailable, with the shared placeholder photo', () => {
    const animal = surrenderToPhotosPendingAnimal(request({ animalName: 'Mr. Whiskers' }));
    expect(animal.photosPending).toBe(true);
    expect(animal.available).toBe(false);
    expect(animal.underRepair).toBeUndefined();
    expect(animal.photoUrl).toBe(PHOTOS_PENDING_PLACEHOLDER);
    expect(animal.backstory).toBe('');
  });

  it('mints a non-empty, unique id per call', () => {
    const a = surrenderToPhotosPendingAnimal(request({ animalName: 'x' }));
    const b = surrenderToPhotosPendingAnimal(request({ animalName: 'x' }));
    expect(a.id.length).toBeGreaterThan(0);
    expect(a.id).not.toBe(b.id);
  });

  it('falls back to "Unnamed surrender" when the animal name is empty', () => {
    const animal = surrenderToPhotosPendingAnimal(request({ animalName: '' }));
    expect(animal.name).toBe('Unnamed surrender');
  });
});
