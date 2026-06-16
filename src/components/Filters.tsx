export interface FiltersState {
  keyword: string;
  prefecture: string;
  weatherTag: string;
  catchState: 'all' | 'yes' | 'no' | 'unknown';
  skunkedState: 'all' | 'yes' | 'no' | 'unknown';
  hasShopping: 'all' | 'yes' | 'no';
  theoryTag: string;
}
