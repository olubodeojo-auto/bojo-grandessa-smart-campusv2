import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("../lib/supabase", () => ({
  default: { rpc: rpcMock },
}));

import { publishResult, reviewResult } from "./resultService";

describe("result publishing RPC", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("calls publish_result with the result ID and surfaces Supabase errors", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    await publishResult("result-1");
    expect(rpcMock).toHaveBeenCalledWith("publish_result", {
      target_result_id: "result-1",
    });

    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "Only an authorised administrator can publish results." },
    });
    await expect(publishResult("result-2"))
      .rejects.toThrow("Unable to publish result: Only an authorised administrator can publish results.");

    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    await reviewResult("result-5", "publish");
    expect(rpcMock).toHaveBeenLastCalledWith("publish_result", {
      target_result_id: "result-5",
    });
  });

  it("keeps return and unpublish actions on review_result", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await reviewResult("result-3", "return", "Please correct the marks.");
    expect(rpcMock).toHaveBeenCalledWith("review_result", {
      target_result_id: "result-3",
      decision: "return",
      reason: "Please correct the marks.",
    });

    await reviewResult("result-4", "unpublish");
    expect(rpcMock).toHaveBeenLastCalledWith("review_result", {
      target_result_id: "result-4",
      decision: "unpublish",
      reason: null,
    });
  });
});
