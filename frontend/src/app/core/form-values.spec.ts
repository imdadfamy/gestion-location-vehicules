import { blankToNull } from './data/form-values';

describe('blankToNull', () => {
  it('remplace les champs vides par null et garde le reste', () => {
    expect(blankToNull({ a: '', b: '  ', c: 'x', d: 0, e: null, f: false })).toEqual({
      a: null,
      b: null,
      c: 'x',
      d: 0,
      e: null,
      f: false,
    });
  });
});
