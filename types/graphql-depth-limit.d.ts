declare module 'graphql-depth-limit' {
  import { ValidationRule } from 'graphql';
  
  interface Options {
    ignore?: string[] | ((fieldName: string) => boolean);
  }
  
  function depthLimit(
    maxDepth: number,
    options?: Options,
    callback?: (depths: Record<string, number>) => void
  ): ValidationRule;
  
  export = depthLimit;
}

