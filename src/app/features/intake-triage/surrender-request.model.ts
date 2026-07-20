/** The public surrender-request intake form model. Every field has a concrete, non-empty
 * initial value (and `preferredContactTimes` starts non-empty) so the WebMCP implicit-tool
 * schema inference can derive types — empty strings/arrays or null would break inference. */
export interface SurrenderRequest {
  ownerName: string;
  animalName: string;
  species: string;
  /** The animal's current condition, as described by the surrendering owner. */
  condition: string;
  reason: string;
  preferredContactTimes: string[];
}

export const EMPTY_SURRENDER_REQUEST: SurrenderRequest = {
  ownerName: '',
  animalName: '',
  species: 'Bear',
  condition: '',
  reason: '',
  preferredContactTimes: ['morning'],
};
