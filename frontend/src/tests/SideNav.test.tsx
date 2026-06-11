import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import SideNav from "../components/layout/SideNav";

describe("SideNav", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts collapsed and opens on user action", () => {
    const { container, unmount } = render(<SideNav activeId="queue" />);
    const nav = container.querySelector(".cf-sidenav");

    expect(nav).toHaveClass("cf-sidenav--collapsed");
    expect(screen.getByRole("button", { name: "Expand navigation" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Request Queue" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    fireEvent.click(screen.getByRole("button", { name: "Expand navigation" }));
    expect(nav).not.toHaveClass("cf-sidenav--collapsed");

    unmount();
    const reopened = render(<SideNav activeId="queue" />);
    expect(reopened.container.querySelector(".cf-sidenav")).toHaveClass(
      "cf-sidenav--collapsed",
    );
  });
});
