// Hand-written companion to the generated validator, which is plain JavaScript.
//
// Ajv emits a function that returns a boolean and hangs its errors off itself.
// Typing it here rather than generating a .d.ts keeps the generator simple and
// the shape explicit.
import type { ErrorObject } from 'ajv';

declare const validate: {
  (document: unknown): boolean;
  errors?: ErrorObject[] | null;
};

export default validate;
export { validate };
