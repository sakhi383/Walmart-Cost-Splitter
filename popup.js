let STATE = {
  people: [],
  items: [], // { title, unitInfo, unitPrice, qty, assigned: [] }
  fees: { tax: 0, shipping: 0, discount: 0 }, // tax ignored; we compute via globalTaxRate
  globalTaxRate: 0 // percent
};

// Formatters
function dollars2(x){ return "$" + (Math.round(x*100)/100).toFixed(2); } // unit & item totals
function dollars3(x){ return "$" + (Math.round(x*1000)/1000).toFixed(3); } // per-person & fees
const r3 = x => Math.round(x*1000)/1000;

function renderCart() {
  const cartDiv = document.getElementById("cart");
  if (!STATE.items.length) { cartDiv.innerHTML = "<p>No items found.</p>"; return; }

  let html = `
    <div style="margin:6px 0 12px 0; padding:6px; border:1px solid #eee; background:#fafafa">
      <label><b>Tax % (applies to all items):</b>
        <input id="globalTaxRate" type="number" step="0.001" min="0" style="width:90px; margin-left:6px" value="${STATE.globalTaxRate}">
      </label>
    </div>
    <h3>Items</h3>
  `;

  STATE.items.forEach((it, idx) => {
    const line = it.unitPrice * it.qty;
    const itemTax = line * (STATE.globalTaxRate/100);
    const lineAfterTax = line + itemTax;

    html += `<div style="border:1px solid #ddd; padding:6px; margin:6px 0">
      <div><b>${it.title}</b>${it.unitInfo ? `<br><span style="color:#666">${it.unitInfo}</span>` : ""}</div>
      <div>Unit: ${dollars2(it.unitPrice)} | Qty: ${it.qty} | Item total: ${dollars2(line)}</div>
      <div><i>Item total after tax (${STATE.globalTaxRate}%):</i> ${dollars2(lineAfterTax)}</div>

      <div style="margin-top:6px">Assign to:</div>
      <div>`;
    STATE.people.forEach(p => {
      const id = `c_${idx}_${p}`;
      const checked = it.assigned?.includes(p) ? "checked" : "";
      html += `<label style="margin-right:6px">
        <input type="checkbox" id="${id}" data-idx="${idx}" data-person="${p}" ${checked}>
        ${p}
      </label>`;
    });
    html += `</div>
      <div style="margin-top:6px">
        <button class="assign-me" data-idx="${idx}">Assign to me</button>
        <button class="assign-all" data-idx="${idx}">Assign to everyone</button>
      </div>
    </div>`;
  });

  cartDiv.innerHTML = html;

  // global tax rate
  document.getElementById("globalTaxRate").addEventListener("input", (e) => {
    STATE.globalTaxRate = Number(e.target.value) || 0;
    renderCart();           // refresh item preview numbers
    computeAndRenderTotals();
  });

  // wire checkboxes
  STATE.items.forEach((it, idx) => {
    STATE.people.forEach(p => {
      const box = document.getElementById(`c_${idx}_${p}`);
      if (box) {
        box.addEventListener("change", () => {
          it.assigned = it.assigned || [];
          if (box.checked) {
            if (!it.assigned.includes(p)) it.assigned.push(p);
          } else {
            it.assigned = it.assigned.filter(x => x !== p);
          }
          computeAndRenderTotals();
        });
      }
    });
  });

  // quick-assign buttons
  document.querySelectorAll(".assign-me").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      const me = STATE.people[0] || "";
      STATE.items[idx].assigned = me ? [me] : [];
      renderCart();
      computeAndRenderTotals();
    });
  });
  document.querySelectorAll(".assign-all").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      STATE.items[idx].assigned = [...STATE.people];
      renderCart();
      computeAndRenderTotals();
    });
  });
}

function computeAndRenderTotals() {
  const per = Object.fromEntries(STATE.people.map(p => [p, { pre:0, tax:0, other:0, total:0 }]));

  // 1) items + per-item tax via global rate; split within assigned group
  let totalTax = 0;
  for (const it of STATE.items) {
    const group = (it.assigned && it.assigned.length) ? it.assigned : STATE.people;
    const line = it.unitPrice * it.qty;
    const itemTax = line * (STATE.globalTaxRate/100);
    totalTax += itemTax;

    const share = group.length ? line / group.length : 0;
    const taxShare = group.length ? itemTax / group.length : 0;

    for (const p of group) {
      per[p].pre += share;
      per[p].tax += taxShare;
    }
  }

  // 2) shipping+discount prorated by pre-subtotal
  const globalFees = (STATE.fees.shipping || 0) + (STATE.fees.discount || 0);
  const subtotalPre = Object.values(per).reduce((s,r)=>s+r.pre,0);
  for (const p of STATE.people) {
    const w = subtotalPre ? per[p].pre / subtotalPre : 0;
    per[p].other = globalFees * w;
    per[p].total = per[p].pre + per[p].tax + per[p].other;

    per[p].pre   = r3(per[p].pre);
    per[p].tax   = r3(per[p].tax);
    per[p].other = r3(per[p].other);
    per[p].total = r3(per[p].total);
  }

  // 3) reconcile thousandths
  const trueSum = r3(subtotalPre + totalTax + globalFees);
  let entries = STATE.people.map(p => ({ p, v: per[p].total }));
  let roundedSum = r3(entries.reduce((s,e)=>s+e.v,0));
  let diffMillis = Math.round((trueSum - roundedSum) * 1000);
  if (diffMillis !== 0 && entries.length) {
    let idx = entries.map((e,i)=>({i,v:e.v})).sort((a,b)=>b.v-a.v)[0].i;
    entries[idx].v = r3(entries[idx].v + diffMillis/1000);
  }

  // Totals UI (3dp)
  const totalsDiv = document.getElementById("totals");
  let html = "";
  entries.forEach(e => {
    const p   = e.p;
    const pre = per[p].pre;
    const tax = per[p].tax;
    const oth = per[p].other;
    html += `${p}: ${dollars3(e.v)} <span style="color:#666">(items ${dollars3(pre)}, tax ${dollars3(tax)}, other ${dollars3(oth)})</span><br>`;
  });
  totalsDiv.innerHTML = html;

  // Fees box: show computed tax sum
  document.getElementById("tax").textContent = dollars3(r3(totalTax));
  document.getElementById("shipping").textContent = dollars3(STATE.fees.shipping||0);
  document.getElementById("discount").textContent = dollars3(STATE.fees.discount||0);
}

document.getElementById("loadBtn").addEventListener("click", async () => {
  const raw = document.getElementById("peopleInput").value.trim();
  STATE.people = raw ? raw.split(",").map(s=>s.trim()).filter(Boolean) : [];
  if (!STATE.people.length) {
    alert("Enter at least one person, for example Ava,Ben,Cam");
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { type: "GET_CART" }, res => {
    if (!res || !res.items) {
      document.getElementById("cart").innerHTML = "<p>Could not read the cart. Open your Walmart cart page and try again.</p>";
      return;
    }
    STATE.items = res.items.map(it => ({ ...it, assigned: [...STATE.people] }));
    // ignore res.fees.tax; compute from globalTaxRate
    STATE.fees = { tax: 0, shipping: (res.fees?.shipping||0), discount: (res.fees?.discount||0) };
    renderCart();
    computeAndRenderTotals();
  });
});
