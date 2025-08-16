declare module "ethereum-blockies" {
  interface BlockiesOptions {
    seed: string;
    size?: number;
    scale?: number;
    color?: string;
    bgcolor?: string;
    spotcolor?: string;
  }

  interface Blockies {
    create(options: BlockiesOptions): HTMLCanvasElement;
  }

  const blockies: Blockies;
  export default blockies;
}
