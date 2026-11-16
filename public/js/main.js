const CATEGORY_MAP = {
  cement: { emoji: "🏭", label: "Cement" },
  tmt_steel: { emoji: "⛓️", label: "TMT Steel" },
  contractors: { emoji: "👷", label: "Contractors" },
  machinery: { emoji: "🚜", label: "Machinery" },
  plumbing_electrical: { emoji: "🔧", label: "Plumbing/Electrical" },
};

const state = { city: "all", category: "all", search: "" };
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function waLink(phone, name) {
  const msg = encodeURIComponent(`Hi ${name}, I found your listing on Civix. I need a quote for my site.`);
  return `https://wa.me/91${phone}?text=${msg}`;
}

function vendorCardHTML(v) {
  const cat = CATEGORY_MAP[v.category];
  const initials = esc(String(v.company_name).split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase());
  return `
  <article class="vendor-card" style="cursor:pointer;" onclick="if(!event.target.closest('a,button')) window.location.href='/vendor.html?id=${esc(v.id)}'">
    <div class="vendor-card__banner"></div>
    <div class="vendor-card__body">
      <div class="vendor-card__top">
        ${v.logo_url
          ? `<img class="vendor-card__avatar" src="${esc(v.logo_url)}" alt="${esc(v.company_name)}">`
          : `<div class="vendor-card__avatar">${initials}</div>`}
        <div class="vendor-card__title-wrap">
          <p class="vendor-card__name">${esc(v.company_name)}
            ${v.is_verified ? '<span class="verified-badge" title="Verified">✔</span>' : ""}
          </p>
          <p class="vendor-card__meta">${esc(v.role)} • ${cat ? cat.emoji + " " + cat.label : esc(v.category)} • ${esc(v.city)}</p>
        </div>
        <span class="rating"><span class="rating__star">★</span>${Number(v.rating).toFixed(1)}</span>
      </div>
      ${v.materials ? `<div class="vendor-card__materials">${esc(v.materials)}</div>` : ""}
      <div class="vendor-card__actions">
        <a class="action-btn action-btn--call" href="tel:+91${esc(v.phone)}">📞 Call</a>
        <a class="action-btn action-btn--whatsapp" target="_blank" rel="noopener" href="${waLink(esc(v.phone), v.company_name)}">💬 WhatsApp</a>
      </div>
    </div>
  </article>`;
}

// ---- use my current location -> nearest supported city ----
const SUPPORTED_CITIES = ["Indore", "Bhopal", "Jabalpur", "Gwalior"];

$("#locateBtn")?.addEventListener("click", () => {
  if (!navigator.geolocation) {
    alert("Location isn't supported on this browser/device.");
    return;
  }
  const btn = $("#locateBtn");
  btn.disabled = true;
  btn.textContent = "Locating…";

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        const { latitude, longitude } = pos.coords;
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
        );
        const data = await res.json();
        const addr = data.address || {};
        const candidates = [addr.city, addr.town, addr.county, addr.state_district, addr.state]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const match = SUPPORTED_CITIES.find((c) => candidates.includes(c.toLowerCase()));

        if (match) {
          state.city = match;
          $("#currentCityLabel").textContent = match;
          $$(".city-dropdown__item").forEach((b) =>
            b.classList.toggle("is-active", b.dataset.city === match)
          );
        } else {
          alert("Civix isn't live in your exact city yet — showing all cities for now.");
          state.city = "all";
          $("#currentCityLabel").textContent = "All Cities";
        }
        loadVendors();
      } catch (err) {
        alert("Couldn't detect your city. Please pick one manually.");
      } finally {
        btn.disabled = false;
        btn.textContent = "🎯 Use my current location";
        $("#cityDropdown").hidden = true;
      }
    },
    () => {
      alert("Location permission denied. Please pick a city manually.");
      btn.disabled = false;
      btn.textContent = "🎯 Use my current location";
    }
  );
});

async function loadVendors() {
  const grid = $("#vendorGrid");
  const empty = $("#emptyState");
  empty.hidden = true;
  grid.innerHTML = Array(3).fill(`
    <div class="skeleton-card">
      <div class="skeleton-line" style="width:60%"></div>
      <div class="skeleton-line" style="width:40%; height:10px;"></div>
      <div class="skeleton-line" style="width:100%; height:36px; border-radius:8px;"></div>
    </div>`).join("");

  const params = new URLSearchParams({ city: state.city, category: state.category, search: state.search });
  const res = await fetch(`/api/vendors?${params.toString()}`);
  const data = await res.json();

  if (!data.vendors || !data.vendors.length) {
    grid.innerHTML = "";
    empty.hidden = false;
  } else {
    empty.hidden = true;
    grid.innerHTML = data.vendors.map(vendorCardHTML).join("");
  }
  $("#resultsCount").textContent = `${data.count || 0} vendor${data.count === 1 ? "" : "s"}`;
  $("#resultsTitle").textContent = state.city === "all" ? "All vendors" : `Vendors in ${state.city}`;
}

$("#cityPillBtn").addEventListener("click", () => { $("#cityDropdown").hidden = !$("#cityDropdown").hidden; });
document.addEventListener("click", (e) => {
  if (!e.target.closest(".city-pill") && !e.target.closest("#cityDropdown")) $("#cityDropdown").hidden = true;
});
$$(".city-dropdown__item").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".city-dropdown__item").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    state.city = btn.dataset.city;
    $("#currentCityLabel").textContent = state.city === "all" ? "All Cities" : state.city;
    $("#cityDropdown").hidden = true;
    loadVendors();
  });
});

$$(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    $$(".chip").forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    state.category = chip.dataset.category;
    loadVendors();
  });
});

let searchTimer;
$("#searchInput").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.search = e.target.value.trim(); loadVendors(); }, 250);
});

function openModal(id) { $(`#${id}`).hidden = false; }
function closeModal(id) { $(`#${id}`).hidden = true; }
$("#postNeedFab").addEventListener("click", () => openModal("rfqOverlay"));
$("#becomeVendorBtn").addEventListener("click", () => openModal("vendorOverlay"));
$$("[data-close]").forEach((btn) => btn.addEventListener("click", () => closeModal(btn.dataset.close)));
$$(".modal-overlay").forEach((ov) => ov.addEventListener("click", (e) => { if (e.target === ov) ov.hidden = true; }));

// ---- RFQ: catalog se items ----
const UNITS = ["Bags", "MT", "Kg", "Nos", "Sq ft", "Cum", "Meters", "Hours", "Days", "Trips", "Sets", "Coils"];
const catalogByName = {};

async function loadCatalog() {
  try {
    const res = await fetch("/api/catalog");
    const data = await res.json();
    (data.products || []).forEach((p) => { catalogByName[p.name.toLowerCase()] = p; });
    $("#catalogList").innerHTML = (data.products || [])
      .map((p) => `<option value="${esc(p.name)}"></option>`)
      .join("");
  } catch (e) {
    // catalog na mile to bhi free text se kaam chalega
  }
}

function rfqRowHTML(removable) {
  return `
    <div class="rfq-item-row">
      <input type="text" class="item-material" list="catalogList" maxlength="120"
             placeholder="Search item, e.g. OPC 53 Cement" required>
      <input type="number" class="item-qty" min="0.01" step="any" placeholder="Qty" required>
      <select class="item-unit">${UNITS.map((u) => `<option>${u}</option>`).join("")}</select>
      ${removable ? '<button type="button" class="remove-item">✕</button>' : ""}
    </div>`;
}

function resetItems() {
  $("#rfqItemsList").innerHTML = rfqRowHTML(false);
}

// catalog ka item chunte hi unit apne aap set ho jaaye
$("#rfqItemsList").addEventListener("input", (e) => {
  if (!e.target.classList.contains("item-material")) return;
  const row = e.target.closest(".rfq-item-row");
  const product = catalogByName[e.target.value.trim().toLowerCase()];
  if (product) {
    row.dataset.productId = product.id;
    row.querySelector(".item-unit").value = product.unit;
  } else {
    delete row.dataset.productId;
  }
});

$("#rfqItemsList").addEventListener("click", (e) => {
  if (e.target.classList.contains("remove-item")) e.target.closest(".rfq-item-row").remove();
});

$("#addItemBtn").addEventListener("click", () => {
  $("#rfqItemsList").insertAdjacentHTML("beforeend", rfqRowHTML(true));
});

$("#rfqForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;

  const items = [...document.querySelectorAll(".rfq-item-row")]
    .map((row) => ({
      product_id: row.dataset.productId || null,
      material: row.querySelector(".item-material").value.trim(),
      qty: parseFloat(row.querySelector(".item-qty").value),
      unit: row.querySelector(".item-unit").value,
    }))
    .filter((i) => i.material && i.qty > 0);

  if (!items.length) { alert("Please add at least one item with quantity"); return; }

  const customerToken = localStorage.getItem("civix_customer_token");
  if (!customerToken) {
    alert("Please login first so you can receive and compare vendor quotes.");
    window.location.href = "/customer-auth.html";
    return;
  }

  const res = await fetch("/api/rfq", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({
      items,
      city: form.city.value,
      location: form.location.value.trim(),
      phone: form.phone.value.trim(),
    }),
  });

  if (res.status === 401) {
    localStorage.removeItem("civix_customer_token");
    alert("Your session expired. Please login again.");
    window.location.href = "/customer-auth.html";
    return;
  }

  const data = await res.json();
  const box = $("#rfqResult");
  box.hidden = false;
  box.textContent = data.message || "Something went wrong";
  box.style.background = res.ok ? "" : "#FEE2E2";
  box.style.color = res.ok ? "" : "#B91C1C";

  if (res.ok) {
    form.reset();
    resetItems();
    loadVendors();
    setTimeout(() => { closeModal("rfqOverlay"); box.hidden = true; }, 2200);
  }
});

$("#vendorForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const payload = Object.fromEntries(new FormData(form).entries());
  const res = await fetch("/api/auth/vendor/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await res.json();
  const box = $("#vendorResult");
  box.hidden = false;
  box.textContent = data.message || "Listing submitted! Pending approval.";
  form.reset();
  setTimeout(() => { closeModal("vendorOverlay"); box.hidden = true; }, 2500);
});

// ---- footer: "List your business" link ----
$("#footerListBusiness")?.addEventListener("click", (e) => {
  e.preventDefault();
  openModal("vendorOverlay");
});

// ---- footer: city links ----
$$("[data-footer-city]").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const city = link.dataset.footerCity;
    state.city = city;
    $("#currentCityLabel").textContent = city;
    $$(".city-dropdown__item").forEach((b) => b.classList.toggle("is-active", b.dataset.city === city));
    window.scrollTo({ top: 0, behavior: "smooth" });
    loadVendors();
  });
});

resetItems();
loadCatalog().then(applyPrefill);
loadVendors();
// ---- homepage: quick requirement + CTAs ----
function openRfqWith(name) {
  resetItems();
  const row = document.querySelector(".rfq-item-row");
  const input = row.querySelector(".item-material");
  input.value = name;
  input.dispatchEvent(new Event("input", { bubbles: true })); // product + unit auto-set
  openModal("rfqOverlay");
  row.querySelector(".item-qty").focus();
}

$("#heroPostBtn")?.addEventListener("click", () => { resetItems(); openModal("rfqOverlay"); });
$("#ctaListBtn")?.addEventListener("click", () => openModal("vendorOverlay"));
$$("[data-quick]").forEach((b) => b.addEventListener("click", () => openRfqWith(b.dataset.quick)));

fetch("/api/vendors?city=all&category=all&search=")
  .then((r) => r.json())
  .then((d) => { const el = $("#statVendors"); if (el) el.textContent = d.count ?? 0; })
  .catch(() => {});

  function applyPrefill() {
  let items = null;
  try { items = JSON.parse(sessionStorage.getItem("civix_rfq_prefill") || "null"); } catch (e) {}
  if (!Array.isArray(items) || !items.length) return;
  sessionStorage.removeItem("civix_rfq_prefill");

  $("#rfqItemsList").innerHTML = items.map((_, i) => rfqRowHTML(i > 0)).join("");
  document.querySelectorAll(".rfq-item-row").forEach((row, i) => {
    const input = row.querySelector(".item-material");
    input.value = items[i].name;
    input.dispatchEvent(new Event("input", { bubbles: true })); // catalog item ho to product + unit set
    row.querySelector(".item-qty").value = items[i].qty;
    row.querySelector(".item-unit").value = items[i].unit;
  });
  openModal("rfqOverlay");
}