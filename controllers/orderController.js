import supabase from "../config/supabaseClient.js";

const ORDER_SELECT = `
  *,
  vendors(id, company_name, phone, city, logo_url, is_verified),
  rfqs(id, location, city, phone, rfq_items(id, material, quantity)),
  quotes(delivery_days, delivery_charge, note, quote_items(rfq_item_id, brand, unit_price, line_total)),
  order_events(id, status, note, created_at),
  reviews(id, rating)
`;

// kaun kya status change kar sakta hai
const VENDOR_TRANSITIONS = {
  confirmed: ["dispatched", "cancelled"],
  dispatched: ["delivered"],
};
const BUYER_TRANSITIONS = {
  confirmed: ["cancelled"],
};

const getMyVendor = async (authUserId) => {
  const { data } = await supabase
    .from("vendors")
    .select("id, company_name")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  return data;
};

// ---------- BUYER: mere saare orders ----------
export const getBuyerOrders = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("customer_id", req.authUserId)
      .eq("buyer_hidden", false)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ message: error.message });
    res.json({ count: data.length, orders: data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------- VENDOR: mujhe mile orders ----------
export const getVendorOrders = async (req, res) => {
  try {
    const vendor = await getMyVendor(req.authUserId);
    if (!vendor) return res.status(403).json({ message: "Only vendors can view this" });

    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("vendor_id", vendor.id)
      .eq("vendor_hidden", false)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ message: error.message });
    res.json({ count: data.length, orders: data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------- Status update (vendor ya buyer, rules ke hisaab se) ----------
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note = "" } = req.body;

    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!order) return res.status(404).json({ message: "Order not found" });

    const vendor = await getMyVendor(req.authUserId);
    let actor = null;
    if (vendor && order.vendor_id === vendor.id) actor = "vendor";
    else if (order.customer_id === req.authUserId) actor = "buyer";
    if (!actor) return res.status(403).json({ message: "This is not your order" });

    const rules = actor === "vendor" ? VENDOR_TRANSITIONS : BUYER_TRANSITIONS;
    const allowed = rules[order.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        message: `You cannot change this order from "${order.status}" to "${status}"`,
      });
    }

    const { data: updated, error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id)
      .select()
      .single();
    if (error) return res.status(500).json({ message: error.message });

    await supabase.from("order_events").insert({
      order_id: id,
      status,
      note: `By ${actor}${note ? ": " + note : ""}`,
    });
        const no = order.order_no ? `CVX-${1000 + Number(order.order_no)}` : String(order.id).slice(0, 8).toUpperCase();
    if (actor === "vendor") {
      notify({
        userId: order.customer_id,
        type: "order_update",
        title: `Order ${no} ${status}`,
        body: note || (status === "delivered" ? "Delivered! Please rate the vendor." : `Your order is now ${status}.`),
        link: "/orders.html?as=buyer",
      });
    } else {
      const { data: v } = await supabase.from("vendors").select("auth_user_id, email").eq("id", order.vendor_id).maybeSingle();
      notify({
        userId: v?.auth_user_id,
        email: v?.email,
        type: "order_update",
        title: `Order ${no} ${status} by customer`,
        body: note || "The customer cancelled this order.",
        link: "/orders.html?as=vendor",
      });
    }

    res.json({ message: `Order marked as ${status}`, order: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const hideOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: order } = await supabase
      .from("orders")
      .select("id, status, customer_id, vendor_id")
      .eq("id", id)
      .maybeSingle();
    if (!order) return res.status(404).json({ message: "Order not found" });

    const vendor = await getMyVendor(req.authUserId);
    let column = null;
    if (vendor && order.vendor_id === vendor.id) column = "vendor_hidden";
    else if (order.customer_id === req.authUserId) column = "buyer_hidden";
    if (!column) return res.status(403).json({ message: "This is not your order" });

    if (!["delivered", "cancelled"].includes(order.status)) {
      return res.status(400).json({ message: "Only delivered or cancelled orders can be removed from your list" });
    }

    const { error } = await supabase.from("orders").update({ [column]: true }).eq("id", id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ message: "Order removed from your list" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};