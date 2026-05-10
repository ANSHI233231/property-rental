import { Controller, Get } from "@nestjs/common";
import { HealthService, HealthResponse } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  async check(): Promise<HealthResponse> {
    return this.health.check();
  }
}
