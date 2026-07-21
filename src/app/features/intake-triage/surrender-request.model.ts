/** The public surrender-request intake form model. Fields that participate in WebMCP schema
 * inference use concrete initial values so the generated tool can derive their types. */
export interface SurrenderRequest {
  ownerName: string;
  animalName: string;
  species: string;
  /** The animal's current condition, as described by the surrendering owner. */
  condition: string;
  reason: string;
}

export const EMPTY_SURRENDER_REQUEST: SurrenderRequest = {
  ownerName: '',
  animalName: '',
  species: 'Bear',
  condition: '',
  reason: '',
};
