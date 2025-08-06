/**
 * Type definitions for @babel/parser
 */

declare module '@babel/parser' {
  export interface ParseOptions {
    sourceType?: 'module' | 'script';
    allowImportExportEverywhere?: boolean;
    allowReturnOutsideFunction?: boolean;
    plugins?: string[];
  }

  export function parse(input: string, options?: ParseOptions): any;
}