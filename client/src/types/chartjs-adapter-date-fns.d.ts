declare module "chartjs-adapter-date-fns" {
  import { TimeAdapter } from "chart.js";

  export const AdapterDateFns: {
    new (): TimeAdapter;
    override(options: object): void;
  };
}
