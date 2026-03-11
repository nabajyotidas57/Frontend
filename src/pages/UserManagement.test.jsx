/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import UserManagement from "./Usermanagement";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_USERS = [
  { id: "u1", firstName: "Alice", lastName: "Chen",  email: "alice@bank.io", enabled: true  },
  { id: "u2", firstName: "Bob",   lastName: "Reyes", email: "bob@bank.io",   enabled: false },
  { id: "u3", username: "david",                     email: "david@bank.io", enabled: true  },
];

const MOCK_ROLES = [{ name: "manager" }, { name: "user" }];

// ─────────────────────────────────────────────────────────────────────────────
// FETCH MOCK FACTORY
// ─────────────────────────────────────────────────────────────────────────────
function mockFetch(overrides = {}) {
  global.fetch = jest.fn((url, options = {}) => {
    const method = options.method || "GET";

    // GET /admin/users
    if (url.includes("/admin/users") && !url.includes("/roles") && method === "GET") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(MOCK_USERS),
      });
    }

    // GET /admin/users/:id/roles
    if (url.includes("/roles") && method === "GET") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(MOCK_ROLES),
      });
    }

    // POST /admin/bulk-users
    if (url.includes("/bulk-users") && method === "POST") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ status: "created", email: "new@bank.io" }]),
      });
    }

    // DELETE /admin/users/:id  (not roles)
    if (url.match(/\/admin\/users\/[^/]+$/) && method === "DELETE") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }

    // POST /admin/users/:id/roles  (assign)
    if (url.includes("/roles") && method === "POST") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }

    // DELETE /admin/users/:id/roles  (remove role)
    if (url.includes("/roles") && method === "DELETE") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }

    // PUT /admin/users/:id/roles  (replace)
    if (url.includes("/roles") && method === "PUT") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }

    // Allow overrides for failure scenarios
    if (overrides[url]) return overrides[url](options);

    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

beforeEach(() => {
  mockFetch();
  jest.spyOn(window, "alert").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// =============================================================================
// 1. StatusChip
// =============================================================================
describe("StatusChip", () => {
  // StatusChip is internal — we test it via rendered rows in UserManagement

  it("renders Active chip with green class", async () => {
    render(<UserManagement />);
    await screen.findByText("Alice Chen");
    const chip = screen.getAllByText("Active")[0];
    expect(chip).toHaveClass("chip-green");
  });

  it("renders Inactive chip with yellow class", async () => {
    render(<UserManagement />);
    await screen.findByText("Bob Reyes");
    const chip = screen.getByText("Inactive");
    expect(chip).toHaveClass("chip-yellow");
  });
});

// =============================================================================
// 2. RoleChip (tested via RoleManagerModal)
// =============================================================================
describe("RoleChip inside RoleManagerModal", () => {
  async function openRoleModal() {
    render(<UserManagement />);
    await screen.findByText("Alice Chen");
    const roleButtons = screen.getAllByTitle("Roles");
    fireEvent.click(roleButtons[0]);
    await screen.findByText("🛡️ Manage Roles");
    // Wait until chips are rendered (roles loaded from fetch)
    await waitFor(() => expect(document.querySelectorAll(".role-chip").length).toBeGreaterThan(0));
  }

  it("renders role chips for current roles", async () => {
    await openRoleModal();
    const chips = document.querySelectorAll(".role-chip");
    const chipLabels = Array.from(chips).map((c) => c.textContent.replace("×", "").trim());
    expect(chipLabels).toContain("Manager");
    expect(chipLabels).toContain("User");
  });

  it("renders a remove button on each role chip", async () => {
    await openRoleModal();
    const removeButtons = screen.getAllByTitle(/Remove .* role/);
    expect(removeButtons).toHaveLength(2);
  });

  it("remove button is disabled while busy", async () => {
    // Only "user" role pre-assigned. POST never resolves → busy stays true when assigning "Manager"
    global.fetch = jest.fn((url, options = {}) => {
      if (url.includes("/roles") && options.method === "POST") {
        return new Promise(() => {}); // never resolves → busy stays true
      }
      if (url.includes("/roles") && !options.method) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ name: "user" }]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_USERS) });
    });

    render(<UserManagement />);
    await screen.findByText("Alice Chen");
    fireEvent.click(screen.getAllByTitle("Roles")[0]);
    await screen.findByText("🛡️ Manage Roles");
    await waitFor(() => expect(document.querySelectorAll(".role-chip").length).toBeGreaterThan(0));

    // Select "Manager" (not assigned) then click Assign — this triggers busy=true
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Manager" } });
    fireEvent.click(screen.getByText("+ Assign"));

    // busy=true → remove buttons must be disabled
    await waitFor(() => {
      const removeButtons = document.querySelectorAll(".chip-remove-btn");
      expect(removeButtons.length).toBeGreaterThan(0);
      removeButtons.forEach((btn) => expect(btn).toBeDisabled());
    });
  });
});

// =============================================================================
// 3. RoleManagerModal
// =============================================================================
describe("RoleManagerModal", () => {
  async function openModal(userIndex = 0) {
    render(<UserManagement />);
    await screen.findByText("Alice Chen");
    const roleButtons = screen.getAllByTitle("Roles");
    fireEvent.click(roleButtons[userIndex]);
    await screen.findByText("🛡️ Manage Roles");
  }

  it("displays user name and email in summary", async () => {
    await openModal();
    const modal = document.querySelector(".modal-overlay");
    expect(within(modal).getByText("Alice Chen")).toBeInTheDocument();
    expect(within(modal).getByText("alice@bank.io")).toBeInTheDocument();
  });

  it("fetches and displays current roles on open", async () => {
    await openModal();
    await waitFor(() => {
      const chips = document.querySelectorAll(".role-chip");
      const chipLabels = Array.from(chips).map((c) => c.textContent.replace("×", "").trim());
      expect(chipLabels).toContain("Manager");
      expect(chipLabels).toContain("User");
    });
  });

  it("shows empty state when user has no roles", async () => {
    global.fetch = jest.fn((url, options = {}) => {
      if (url.includes("/roles") && !options.method) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_USERS) });
    });

    render(<UserManagement />);
    await screen.findByText("Alice Chen");
    fireEvent.click(screen.getAllByTitle("Roles")[0]);
    await screen.findByText("No roles assigned. Add one below.");
  });

  it("shows error if roles fetch fails", async () => {
    global.fetch = jest.fn((url, options = {}) => {
      if (url.includes("/roles") && !options.method) {
        return Promise.resolve({ ok: false, status: 500 });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_USERS) });
    });

    render(<UserManagement />);
    await screen.findByText("Alice Chen");
    fireEvent.click(screen.getAllByTitle("Roles")[0]);
    await screen.findByText(/Could not load current roles/);
  });

  it("assigns a role and refreshes the list", async () => {
    // Start with only "user" role so we can assign "Manager" fresh
    global.fetch = jest.fn((url, options = {}) => {
      if (url.includes("/roles") && !options.method) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ name: "user" }]) });
      }
      if (url.includes("/roles") && options.method === "POST") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_USERS) });
    });

    render(<UserManagement />);
    await screen.findByText("Alice Chen");
    fireEvent.click(screen.getAllByTitle("Roles")[0]);
    await waitFor(() => expect(document.querySelectorAll(".role-chip").length).toBeGreaterThan(0));

    // Select "Manager" (not currently assigned) and assign
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "Manager" } });
    fireEvent.click(screen.getByText("+ Assign"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/roles"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("shows flash error when assigning an already-assigned role", async () => {
    // Only manager role assigned
    global.fetch = jest.fn((url, options = {}) => {
      if (url.includes("/roles") && !options.method) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ name: "manager" }]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_USERS) });
    });

    render(<UserManagement />);
    await screen.findByText("Alice Chen");
    fireEvent.click(screen.getAllByTitle("Roles")[0]);
    await waitFor(() => expect(document.querySelectorAll(".role-chip").length).toBeGreaterThan(0));

    // Dropdown defaults to "Manager" which is already assigned — just click Assign
    fireEvent.click(screen.getByText("+ Assign"));
    await screen.findByText(/already listed/);
  });

  it("removes a role successfully", async () => {
    await openModal();
    await waitFor(() => expect(document.querySelectorAll(".role-chip").length).toBeGreaterThan(0));

    const removeBtn = screen.getByTitle("Remove Manager role");
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/roles"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
    await screen.findByText(/removed/);
  });

  it("shows error if remove fails", async () => {
    global.fetch = jest.fn((url, options = {}) => {
      if (url.includes("/roles") && options.method === "DELETE") {
        return Promise.resolve({ ok: false, status: 403, text: () => Promise.resolve("Forbidden") });
      }
      if (url.includes("/roles") && !options.method) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_ROLES) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_USERS) });
    });

    render(<UserManagement />);
    await screen.findByText("Alice Chen");
    fireEvent.click(screen.getAllByTitle("Roles")[0]);
    await waitFor(() => expect(document.querySelectorAll(".role-chip").length).toBeGreaterThan(0));

    fireEvent.click(screen.getByTitle("Remove Manager role"));
    await screen.findByText(/Remove failed/);
  });

  it("replaces a role successfully", async () => {
    await openModal();
    await waitFor(() => expect(document.querySelectorAll(".role-chip").length).toBeGreaterThan(0));

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "User" } });

    const replaceBtn = screen.getByRole("button", { name: /Manager → User/ });
    fireEvent.click(replaceBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/roles"),
        expect.objectContaining({ method: "PUT" })
      );
    });
    await screen.findByText(/Replaced/);
  });

  it("shows error when replacing with same role", async () => {
    // Only manager role so we can try to replace manager → manager
    global.fetch = jest.fn((url, options = {}) => {
      if (url.includes("/roles") && !options.method) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ name: "manager" }]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_USERS) });
    });

    render(<UserManagement />);
    await screen.findByText("Alice Chen");
    fireEvent.click(screen.getAllByTitle("Roles")[0]);

    // Wait for the role chip to render before looking for the replace button
    await waitFor(() => {
      const chips = document.querySelectorAll(".role-chip");
      expect(chips.length).toBeGreaterThan(0);
    });

    // Dropdown defaults to "Manager", replace button should read "Manager → Manager"
    const replaceBtn = await screen.findByRole("button", { name: /Manager → Manager/ });
    fireEvent.click(replaceBtn);
    await screen.findByText("Pick a different role.");
  });

  it("closes when Done is clicked", async () => {
    await openModal();
    fireEvent.click(screen.getByText("Done"));
    expect(screen.queryByText("🛡️ Manage Roles")).not.toBeInTheDocument();
  });

  it("closes when clicking outside the modal", async () => {
    await openModal();
    const overlay = document.querySelector(".modal-overlay");
    fireEvent.click(overlay);
    expect(screen.queryByText("🛡️ Manage Roles")).not.toBeInTheDocument();
  });
});

// =============================================================================
// 4. UserManagement — main component
// =============================================================================
describe("UserManagement — main", () => {
  it("shows loading state initially", () => {
    // Never resolves
    global.fetch = jest.fn(() => new Promise(() => {}));
    render(<UserManagement />);
    expect(screen.getByText("Loading users…")).toBeInTheDocument();
  });

  it("renders user list after fetch", async () => {
    render(<UserManagement />);
    expect(await screen.findByText("Alice Chen")).toBeInTheDocument();
    expect(screen.getByText("Bob Reyes")).toBeInTheDocument();
    expect(screen.getByText("david")).toBeInTheDocument();
  });

  it("uses username fallback when firstName is missing", async () => {
    render(<UserManagement />);
    await screen.findByText("david"); // user3 has no firstName
  });

  it("shows alert when user fetch fails", async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 500 }));
    render(<UserManagement />);
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("Failed to load users")));
  });

  // ── Search ──────────────────────────────────────────────────────────────────
  describe("Search", () => {
    it("filters users by name", async () => {
      render(<UserManagement />);
      await screen.findByText("Alice Chen");

      const searchInput = screen.getByPlaceholderText("Search users…");
      fireEvent.change(searchInput, { target: { value: "bob" } });

      expect(screen.queryByText("Alice Chen")).not.toBeInTheDocument();
      expect(screen.getByText("Bob Reyes")).toBeInTheDocument();
    });

    it("filters users by email", async () => {
      render(<UserManagement />);
      await screen.findByText("Alice Chen");

      fireEvent.change(screen.getByPlaceholderText("Search users…"), { target: { value: "david@bank.io" } });
      expect(screen.getByText("david")).toBeInTheDocument();
      expect(screen.queryByText("Alice Chen")).not.toBeInTheDocument();
    });

    it("shows empty state when no results match", async () => {
      render(<UserManagement />);
      await screen.findByText("Alice Chen");

      fireEvent.change(screen.getByPlaceholderText("Search users…"), { target: { value: "zzznomatch" } });
      expect(screen.getByText("No users found matching your search.")).toBeInTheDocument();
    });

    it("resets to page 1 when search changes", async () => {
      render(<UserManagement />);
      await screen.findByText("Alice Chen");

      fireEvent.change(screen.getByPlaceholderText("Search users…"), { target: { value: "alice" } });
      expect(screen.getByText(/Page/)).toHaveTextContent("Page 1");
    });
  });

  // ── Pagination ───────────────────────────────────────────────────────────────
  describe("Pagination", () => {
    it("shows Prev disabled on first page", async () => {
      render(<UserManagement />);
      await screen.findByText("Alice Chen");
      expect(screen.getByText("Prev")).toBeDisabled();
    });

    it("shows Next disabled when only one page", async () => {
      render(<UserManagement />);
      await screen.findByText("Alice Chen");
      expect(screen.getByText("Next")).toBeDisabled();
    });
  });

  // ── Add User Modal ───────────────────────────────────────────────────────────
  describe("Add User Modal", () => {
    it("opens when + Add User is clicked", async () => {
      render(<UserManagement />);
      await screen.findByText("Alice Chen");
      fireEvent.click(screen.getByText("+ Add User"));
      expect(screen.getByText("Add New User")).toBeInTheDocument();
    });

    it("shows validation error when email is empty", async () => {
      render(<UserManagement />);
      await screen.findByText("Alice Chen");
      fireEvent.click(screen.getByText("+ Add User"));
      fireEvent.click(screen.getByText("Create User"));
      expect(screen.getByText("Email is required.")).toBeInTheDocument();
    });

    it("shows validation error for invalid email", async () => {
      render(<UserManagement />);
      await screen.findByText("Alice Chen");
      fireEvent.click(screen.getByText("+ Add User"));

      fireEvent.change(screen.getByPlaceholderText("Email Address"), { target: { value: "not-an-email" } });
      fireEvent.click(screen.getByText("Create User"));
      expect(screen.getByText("Invalid email address.")).toBeInTheDocument();
    });

    it("creates user and closes modal on success", async () => {
      render(<UserManagement />);
      await screen.findByText("Alice Chen");
      fireEvent.click(screen.getByText("+ Add User"));

      fireEvent.change(screen.getByPlaceholderText("Email Address"), { target: { value: "new@bank.io" } });
      fireEvent.click(screen.getByText("Create User"));

      await waitFor(() => {
        expect(screen.queryByText("Add New User")).not.toBeInTheDocument();
      });
    });

    it("shows error when API returns failed status", async () => {
      global.fetch = jest.fn((url) => {
        if (url.includes("/bulk-users")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ status: "failed", error: "Email already exists" }]),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_USERS) });
      });

      render(<UserManagement />);
      await screen.findByText("Alice Chen");
      fireEvent.click(screen.getByText("+ Add User"));

      fireEvent.change(screen.getByPlaceholderText("Email Address"), { target: { value: "alice@bank.io" } });
      fireEvent.click(screen.getByText("Create User"));

      await screen.findByText(/Email already exists/);
    });

    it("closes when Cancel is clicked", async () => {
      render(<UserManagement />);
      await screen.findByText("Alice Chen");
      fireEvent.click(screen.getByText("+ Add User"));
      fireEvent.click(screen.getByText("Cancel"));
      expect(screen.queryByText("Add New User")).not.toBeInTheDocument();
    });
  });

  // ── Delete User Modal ────────────────────────────────────────────────────────
  describe("Delete User Modal", () => {
    it("opens with correct user email", async () => {
      render(<UserManagement />);
      await screen.findByText("Alice Chen");
      fireEvent.click(screen.getAllByTitle("Delete")[0]);

      const modal = document.querySelector(".modal-overlay");
      expect(within(modal).getByText("alice@bank.io")).toBeInTheDocument();
      expect(within(modal).getByRole("heading", { name: "Delete User" })).toBeInTheDocument();
    });

    it("deletes user and closes modal", async () => {
      render(<UserManagement />);
      await screen.findByText("Alice Chen");
      fireEvent.click(screen.getAllByTitle("Delete")[0]);
      fireEvent.click(screen.getByRole("button", { name: "Delete User" }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/admin/users/u1"),
          expect.objectContaining({ method: "DELETE" })
        );
      });
      await waitFor(() => {
        expect(screen.queryByRole("heading", { name: "Delete User" })).not.toBeInTheDocument();
      });
    });

    it("shows alert when delete fails", async () => {
      global.fetch = jest.fn((url, options = {}) => {
        if (options.method === "DELETE" && !url.includes("/roles")) {
          return Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve("Server Error") });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_USERS) });
      });

      render(<UserManagement />);
      await screen.findByText("Alice Chen");
      fireEvent.click(screen.getAllByTitle("Delete")[0]);
      fireEvent.click(screen.getByRole("button", { name: "Delete User" }));

      await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("Delete failed")));
    });

    it("closes when Cancel is clicked", async () => {
      render(<UserManagement />);
      await screen.findByText("Alice Chen");
      fireEvent.click(screen.getAllByTitle("Delete")[0]);
      fireEvent.click(screen.getByText("Cancel"));
      expect(screen.queryByRole("heading", { name: "Delete User" })).not.toBeInTheDocument();
    });
  });
});