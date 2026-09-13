const SUPABASE_URL = "https://azlbkyjcqitaknflkqhr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6bGJreWpjcWl0YWtuZmxrcWhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMDIwNTYsImV4cCI6MjEwNDg3ODA1Nn0.gGR2lEfWh7lAwrIGZUbgUVmIv4mFkgd-rn6oUXZbWSo";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let accountsData = [];
let activeFilter = "all";
let searchTerm = "";
const openedProfiles = new Set(); // Remember expanded accordion state

window.openModal = function (id) {
  const m = document.getElementById(id);
  if (m) m.classList.add("active");
};

window.closeModal = function (id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove("active");
};

document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  fetchAccountsAndProfiles();
});

function setupEventListeners() {
  const accountForm = document.getElementById("accountForm");
  if (accountForm) {
    accountForm.addEventListener("submit", handleAccountSubmit);
  }

  const profileForm = document.getElementById("profileForm");
  if (profileForm) {
    profileForm.addEventListener("submit", handleProfileSubmit);
  }

  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchTerm = e.target.value.toLowerCase();
      render();
    });
  }

  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      activeFilter = e.target.getAttribute("data-filter");
      render();
    });
  });
}

async function fetchAccountsAndProfiles() {
  const container = document.getElementById("accountsContainer");

  try {
    const { data, error } = await supabaseClient
      .from("accounts")
      .select(`
        id,
        email,
        created_at,
        profiles (
          id,
          customer_name,
          profile_name,
          pin,
          expiry_date,
          has_warranty,
          notes
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase fetch error:", error);
      if (container) {
        container.innerHTML = `<p class="loading-text" style="color:#ef4444;">Supabase Error: ${error.message}</p>`;
      }
      return;
    }

    accountsData = (data || []).map((acc) => {
      const sorted = (acc.profiles || []).sort(
        (a, b) => new Date(a.expiry_date) - new Date(b.expiry_date)
      );
      return { ...acc, profiles: sorted };
    });

    render();
  } catch (err) {
    console.error("Fatal error:", err);
    if (container) {
      container.innerHTML = `<p class="loading-text" style="color:#ef4444;">Error: ${err.message}</p>`;
    }
  }
}

function calculateDaysRemaining(expiryDateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(expiryDateStr);
  expiry.setHours(0, 0, 0, 0);

  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getBadgeDetails(daysRemaining) {
  if (daysRemaining < 0) {
    return { text: `${Math.abs(daysRemaining)}d Expired`, class: "badge-red" };
  } else if (daysRemaining === 0) {
    return { text: "Expires Today", class: "badge-red" };
  } else if (daysRemaining <= 2) {
    return { text: `${daysRemaining}d left`, class: "badge-red" };
  } else if (daysRemaining <= 7) {
    return { text: `${daysRemaining}d left`, class: "badge-yellow" };
  } else {
    return { text: `${daysRemaining}d left`, class: "badge-green" };
  }
}

window.toggleProfileAccordion = function (profileId) {
  const item = document.getElementById(`profile-item-${profileId}`);
  if (!item) return;

  if (item.classList.contains("open")) {
    item.classList.remove("open");
    openedProfiles.delete(profileId);
  } else {
    item.classList.add("open");
    openedProfiles.add(profileId);
  }
};

function render() {
  const container = document.getElementById("accountsContainer");
  if (!container) return;
  container.innerHTML = "";

  if (accountsData.length === 0) {
    container.innerHTML = `<p class="loading-text">No accounts added yet. Click "+ Add Account" to start.</p>`;
    return;
  }

  let visibleCards = 0;

  accountsData.forEach((acc) => {
    const filteredProfiles = acc.profiles.filter((p) => {
      const days = calculateDaysRemaining(p.expiry_date);

      const matchSearch =
        acc.email.toLowerCase().includes(searchTerm) ||
        p.customer_name.toLowerCase().includes(searchTerm) ||
        p.profile_name.toLowerCase().includes(searchTerm) ||
        (p.notes && p.notes.toLowerCase().includes(searchTerm));

      if (!matchSearch) return false;

      if (activeFilter === "soon") return days >= 0 && days <= 3;
      if (activeFilter === "expired") return days < 0;
      if (activeFilter === "warranty") return p.has_warranty === true;
      return true;
    });

    if (filteredProfiles.length === 0 && (searchTerm || activeFilter !== "all")) {
      return;
    }

    visibleCards++;
    const slotCount = acc.profiles.length;
    const isFull = slotCount >= 5;

    const card = document.createElement("div");
    card.className = "account-card";

    card.innerHTML = `
      <div class="account-header">
        <div class="account-title-wrap">
          <span class="account-email">${acc.email}</span>
          <span class="slot-badge ${isFull ? "full" : ""}">
            ${slotCount}/5 Slots
          </span>
        </div>
        <div class="account-actions">
          <button class="btn btn-sm btn-primary" onclick="window.openAddProfileModal('${acc.id}', ${isFull})">
            + Slot
          </button>
          <button class="btn btn-sm btn-danger" onclick="window.deleteAccount('${acc.id}')">
            Delete
          </button>
        </div>
      </div>
      <div class="profile-list">
        ${
          filteredProfiles.length === 0
            ? `<div style="text-align:center; color: var(--text-muted); padding: 1.25rem; font-size: 0.85rem;">No profiles in this account yet.</div>`
            : filteredProfiles
                .map((p) => {
                  const days = calculateDaysRemaining(p.expiry_date);
                  const badge = getBadgeDetails(days);
                  const isOpen = openedProfiles.has(p.id);

                  return `
                    <div class="profile-item ${isOpen ? "open" : ""}" id="profile-item-${p.id}">
                      <!-- Header/Summary Clickable -->
                      <div class="profile-summary" onclick="window.toggleProfileAccordion('${p.id}')">
                        <div class="profile-left">
                          <span class="expand-indicator">▶</span>
                          <span class="profile-name-text">${p.profile_name}</span>
                        </div>
                        <div class="profile-right">
                          <span class="expiry-date-text">${p.expiry_date}</span>
                          <span class="badge ${badge.class}">${badge.text}</span>
                        </div>
                      </div>

                      <!-- Expanded Details -->
                      <div class="profile-details">
                        <div class="info-grid">
                          <div class="info-item">
                            <span class="info-label">Customer Name</span>
                            <span class="info-value"><strong>${p.customer_name}</strong></span>
                          </div>
                          <div class="info-item">
                            <span class="info-label">Profile PIN</span>
                            <span class="info-value">${p.pin || "—"}</span>
                          </div>
                          <div class="info-item">
                            <span class="info-label">Warranty</span>
                            <span class="info-value">
                              ${p.has_warranty ? `<span class="warranty-tag">Active</span>` : `<span style="color:#777;">No Warranty</span>`}
                            </span>
                          </div>
                          <div class="info-item">
                            <span class="info-label">Notes / Catatan</span>
                            <span class="info-value ${!p.notes ? "empty" : ""}">${p.notes || "None"}</span>
                          </div>
                        </div>

                        <div class="details-actions">
                          <button class="btn btn-renew" onclick="window.renewProfile('${p.id}', '${p.expiry_date}')">+30 Days</button>
                          <button class="btn btn-edit" onclick="window.openEditProfileModal('${p.id}')">Edit</button>
                          <button class="btn btn-danger" onclick="window.deleteProfile('${p.id}')">Delete</button>
                        </div>
                      </div>
                    </div>
                  `;
                })
                .join("")
        }
      </div>
    `;

    container.appendChild(card);
  });

  if (visibleCards === 0 && accountsData.length > 0) {
    container.innerHTML = `<p class="loading-text">No profiles match the filter.</p>`;
  }
}

// Account actions
async function handleAccountSubmit(e) {
  e.preventDefault();
  const emailInput = document.getElementById("accountEmail");
  const email = emailInput.value.trim();

  const { error } = await supabaseClient.from("accounts").insert([{ email }]);
  if (error) {
    alert("Failed to add account: " + error.message);
    return;
  }

  window.closeModal("accountModal");
  emailInput.value = "";
  fetchAccountsAndProfiles();
}

window.deleteAccount = async function (id) {
  if (!confirm("Are you sure you want to delete this account and all linked customer profiles?")) return;
  const { error } = await supabaseClient.from("accounts").delete().eq("id", id);
  if (error) alert("Error deleting: " + error.message);
  else fetchAccountsAndProfiles();
};

// Profile actions
window.openAddProfileModal = function (accountId, isFull) {
  if (isFull) {
    alert("Maximum 5 profiles reached for this account.");
    return;
  }
  document.getElementById("profileForm").reset();
  document.getElementById("profileId").value = "";
  document.getElementById("profileAccountId").value = accountId;
  document.getElementById("profileModalTitle").innerText = "Add Customer Profile";

  const nextMonth = new Date();
  nextMonth.setDate(nextMonth.getDate() + 30);
  document.getElementById("expiryDate").value = nextMonth.toISOString().split("T")[0];

  window.openModal("profileModal");
};

window.openEditProfileModal = function (profileId) {
  let profileToEdit = null;
  accountsData.forEach((acc) => {
    const found = acc.profiles.find((p) => p.id === profileId);
    if (found) profileToEdit = { ...found, account_id: acc.id };
  });

  if (!profileToEdit) return;

  document.getElementById("profileId").value = profileToEdit.id;
  document.getElementById("profileAccountId").value = profileToEdit.account_id;
  document.getElementById("customerName").value = profileToEdit.customer_name;
  document.getElementById("profileName").value = profileToEdit.profile_name;
  document.getElementById("profilePin").value = profileToEdit.pin || "";
  document.getElementById("expiryDate").value = profileToEdit.expiry_date;
  document.getElementById("profileNotes").value = profileToEdit.notes || "";
  document.getElementById("hasWarranty").checked = profileToEdit.has_warranty;

  document.getElementById("profileModalTitle").innerText = "Edit Customer Profile";
  window.openModal("profileModal");
};

async function handleProfileSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("profileId").value;
  const account_id = document.getElementById("profileAccountId").value;
  const customer_name = document.getElementById("customerName").value.trim();
  const profile_name = document.getElementById("profileName").value.trim();
  const pin = document.getElementById("profilePin").value.trim();
  const expiry_date = document.getElementById("expiryDate").value;
  const notes = document.getElementById("profileNotes").value.trim();
  const has_warranty = document.getElementById("hasWarranty").checked;

  const payload = {
    account_id,
    customer_name,
    profile_name,
    pin,
    expiry_date,
    notes,
    has_warranty,
  };

  let res;
  if (id) {
    // Update existing profile tanpa buang data lain
    res = await supabaseClient.from("profiles").update(payload).eq("id", id);
    if (!res.error) openedProfiles.add(id); // Pastikan bila update, kad kekal terbuka
  } else {
    res = await supabaseClient.from("profiles").insert([payload]);
  }

  if (res.error) {
    alert("Operation failed: " + res.error.message);
    return;
  }

  window.closeModal("profileModal");
  fetchAccountsAndProfiles();
}

window.renewProfile = async function (profileId, currentExpiryDate) {
  const current = new Date(currentExpiryDate);
  current.setDate(current.getDate() + 30);
  const newDate = current.toISOString().split("T")[0];

  const { error } = await supabaseClient
    .from("profiles")
    .update({ expiry_date: newDate })
    .eq("id", profileId);

  if (error) {
    alert("Failed to renew: " + error.message);
  } else {
    openedProfiles.add(profileId); // Biarkan tetap terbuka lepas renew
    fetchAccountsAndProfiles();
  }
};

window.deleteProfile = async function (profileId) {
  if (!confirm("Are you sure you want to remove this profile slot?")) return;
  const { error } = await supabaseClient.from("profiles").delete().eq("id", profileId);
  if (error) {
    alert("Error deleting: " + error.message);
  } else {
    openedProfiles.delete(profileId);
    fetchAccountsAndProfiles();
  }
};
