/** Shape of a populated User or Vehicle ref read from a lean() query. */
export interface PopulatedRef {
  _id?: { toString(): string };
  name?: string;
  email?: string;
  phoneNumber?: string;
  registrationNumber?: string;
  model?: string;
  toString(): string;
}
