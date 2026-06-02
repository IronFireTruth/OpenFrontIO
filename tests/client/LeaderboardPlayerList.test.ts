import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RankedType } from "../../src/core/game/Game";
import { LeaderboardPlayerList } from "../../src/client/components/leaderboard/LeaderboardPlayerList";

const { fetchPlayerLeaderboard, getUserMe } = vi.hoisted(() => ({
  fetchPlayerLeaderboard: vi.fn(),
  getUserMe: vi.fn(),
}));

vi.mock("../../src/client/Api", () => ({
  fetchPlayerLeaderboard,
  getUserMe,
}));

vi.mock("../../src/client/Utils", () => ({
  translateText: vi.fn((key: string) => key),
}));

function makeEntry(id: string, rank: number) {
  return {
    rank,
    elo: 1000 + rank,
    peakElo: 1000 + rank,
    wins: 10,
    losses: 5,
    total: 15,
    public_id: id,
    username: `user-${id}`,
    clanTag: null,
  };
}

function makePage(startRank: number, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const rank = startRank + index;
    return makeEntry(`p${rank}`, rank);
  });
}

describe("LeaderboardPlayerList expanded leaderboard", () => {
  let el: LeaderboardPlayerList;

  beforeEach(async () => {
    fetchPlayerLeaderboard.mockReset();
    getUserMe.mockReset();
    getUserMe.mockResolvedValue(false);

    el = new LeaderboardPlayerList();
    document.body.appendChild(el);
    await el.updateComplete;
  });

  afterEach(() => {
    if (el.isConnected) {
      document.body.removeChild(el);
    }
  });

  it("appends more ranked players across pages", async () => {
    fetchPlayerLeaderboard
      .mockResolvedValueOnce({
        [RankedType.OneVOne]: makePage(1, 50),
      })
      .mockResolvedValueOnce({
        [RankedType.OneVOne]: [makeEntry("p51", 51), makeEntry("p52", 52)],
      });

    await (el as any).loadPlayerLeaderboard(true);
    await (el as any).loadPlayerLeaderboard();

    expect(fetchPlayerLeaderboard).toHaveBeenNthCalledWith(1, 1);
    expect(fetchPlayerLeaderboard).toHaveBeenNthCalledWith(2, 2);
    expect((el as any).playerData).toHaveLength(52);
    expect((el as any).playerData[0].playerId).toBe("p1");
    expect((el as any).playerData[51].playerId).toBe("p52");
  });

  it("deduplicates players when pages overlap", async () => {
    fetchPlayerLeaderboard
      .mockResolvedValueOnce({
        [RankedType.OneVOne]: makePage(1, 50),
      })
      .mockResolvedValueOnce({
        [RankedType.OneVOne]: [makeEntry("p50", 50), makeEntry("p51", 51)],
      });

    await (el as any).loadPlayerLeaderboard(true);
    await (el as any).loadPlayerLeaderboard();

    expect((el as any).playerData).toHaveLength(51);
    expect((el as any).playerData[50].playerId).toBe("p51");
  });

  it("stops requesting more pages when the leaderboard limit is reached", async () => {
    fetchPlayerLeaderboard
      .mockResolvedValueOnce({
        [RankedType.OneVOne]: makePage(1, 50),
      })
      .mockResolvedValueOnce("reached_limit");

    await (el as any).loadPlayerLeaderboard(true);
    await (el as any).loadPlayerLeaderboard();
    await (el as any).loadPlayerLeaderboard();

    expect(fetchPlayerLeaderboard).toHaveBeenCalledTimes(2);
    expect((el as any).playerHasMore).toBe(false);
    expect((el as any).playerData).toHaveLength(50);
  });
});
