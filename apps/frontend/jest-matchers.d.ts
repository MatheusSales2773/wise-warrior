declare namespace jest {
  interface Matchers<R> {
    toHavePathname(pathname: string): R;
  }
}
