/**
 * Type definitions for java-parser
 */

declare module 'java-parser' {
  export function parse(input: string): any;
  
  export interface CSTNode {
    name: string;
    children?: { [key: string]: CSTNode[] };
    location?: {
      startLine: number;
      endLine: number;
      startColumn: number;
      endColumn: number;
    };
    image?: string;
  }
}