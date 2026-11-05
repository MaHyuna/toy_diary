import { isDemo } from './runtime';
import type { Pet } from './types';

type PortraitPet = Pick<Pet, 'id' | 'name' | 'breed'>;
const portraits: Record<string, { file: string; position: string }> = {
  '비숑 프리제': { file: 'bichon', position: '50% 40%' },
  '말티즈': { file: 'maltese', position: '50% 50%' },
  '푸들': { file: 'poodle', position: '50% 25%' },
  '포메라니안': { file: 'pomeranian', position: '50% 30%' },
  '시츄': { file: 'shihtzu', position: '50% 45%' },
  '요크셔테리어': { file: 'yorkshire', position: '25% 50%' },
  '스피츠': { file: 'spitz', position: '50% 78%' },
  '슈나우저': { file: 'schnauzer', position: '80% 45%' },
  '말티푸': { file: 'maltipoo', position: '50% 40%' },
  '믹스견': { file: 'mix', position: '60% 40%' },
};

/** Display-only examples for seeded demo pets; never stored as customer photos. */
export function samplePetPortrait(pet: PortraitPet) {
  if (!isDemo || !/^02[0-9a-f]{30}$/.test(pet.id) || !pet.name.endsWith(' (체험)')) return undefined;
  const number = Number.parseInt(pet.id.slice(2), 16);
  if (!(number >= 1 && number <= 4 || number >= 100 && number <= 123)) return undefined;
  const portrait = portraits[pet.breed];
  return portrait ? { src: `./images/pets/${portrait.file}.jpg`, position: portrait.position } : undefined;
}
