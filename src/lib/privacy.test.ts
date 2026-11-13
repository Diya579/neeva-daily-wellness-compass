import { describe, expect, it } from "vitest";
import { anonymizeCohorts, MIN_COHORT_SIZE } from "./privacy";

describe("employer portal privacy", () => {
  it("hides metrics for a cohort of 9 people", () => {
    const [row] = anonymizeCohorts([{ name: "Design", size: 9, stress: 61, engagement: 70 }]);
    expect(row!.suppressed).toBe(true);
    expect(row!.stress).toBeNull();
    expect(row!.engagement).toBeNull();
  });

  it("shows metrics once a cohort reaches 10 people", () => {
    expect(MIN_COHORT_SIZE).toBe(10);
    const [row] = anonymizeCohorts([{ name: "Sales", size: 10, stress: 48, engagement: 66 }]);
    expect(row!.suppressed).toBe(false);
    expect(row!.stress).toBe(48);
  });
});
