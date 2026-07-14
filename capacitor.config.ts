import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.qc.manager",
  appName: "QC Manager",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
};

export default config;
