import type { Pet } from './types';
import { samplePetPortrait } from './petImages';

export function PetAvatar({ pet }: { pet: Pick<Pet, 'id' | 'name' | 'breed' | 'photos'> }) {
  const sample = samplePetPortrait(pet);
  const uploaded = pet.photos?.[0]?.src;
  return <img className={`pet-photo-avatar${!uploaded && sample ? ' is-sample' : ''}`} loading="lazy" decoding="async"
    src={uploaded || sample?.src || './images/studio-art.webp'}
    style={{ objectPosition: uploaded ? '50% 50%' : sample?.position }}
    alt={`${pet.name} ${uploaded ? '사진' : sample ? '예시 사진' : '기본 일러스트'}`} />;
}
