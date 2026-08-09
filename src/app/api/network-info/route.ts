import { NextResponse } from "next/server";
import { networkInterfaces } from "os";

export async function GET() {
  const ifaces = networkInterfaces();
  let lanIp = "";
  for (const name of Object.keys(ifaces)) {
    for (const net of ifaces[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        lanIp = net.address;
        break;
      }
    }
    if (lanIp) break;
  }
  return NextResponse.json({ lanIp });
}
