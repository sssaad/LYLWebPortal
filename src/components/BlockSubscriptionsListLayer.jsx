import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import moment from "moment";
import Swal from "sweetalert2";
import { getToken } from "../api/getToken";
import CreateBlockSubscriptionModal from "./CreateBlockSubscriptionModal";

const API_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=runStoredProcedure";

const UPDATE_DYNAMIC_DATA_URL =
  "https://api.learnyourlanguage.org/RestController_Thirdparty.php?view=update_dynamic_data";

const headers = {
  projectid: "1",
  userid: "test",
  password: "test",
  "x-api-key": "abc123456789",
  "Content-Type": "application/json",
};

const VALIDITY_DAYS = 60;

const BlockSubscriptionsListLayer = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const FALLBACK_IMG = "https://gostudy.ae/assets/invalid-square.png";

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [priceDraftMap, setPriceDraftMap] = useState({});
  const [savingPriceMap, setSavingPriceMap] = useState({});

  const itemsPerPage = 10;

  const getImageSrc = (item) => {
    const src = item?.imagepath;
    if (!src) return FALLBACK_IMG;

    const s = String(src).trim();
    if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") {
      return FALLBACK_IMG;
    }

    return s;
  };

  const fetchBlockSubscriptions = async () => {
    try {
      setLoading(true);
      setError("");

      const token = await getTokenValue();

      if (!token) {
        setError("Token missing");
        setSubscriptions([]);
        return;
      }

      const payload = { procedureName: "get_all_block_subscriptions" };

      const res = await axios.post(API_URL, payload, {
        headers: { ...headers, token },
      });

      const rows = Array.isArray(res?.data?.data) ? res.data.data : [];
      setSubscriptions(rows);
    } catch (err) {
      setSubscriptions([]);
      setError(
        err?.response?.data?.message || err?.message || "Internal API error"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockSubscriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toNum = (v) => {
    const n = Number(String(v ?? "").replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  };

  const formatAED = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return "—";
    return `AED ${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(x)}`;
  };

  const getTokenValue = async () => {
    const tokenResponse = await getToken();

    if (typeof tokenResponse === "string") return tokenResponse;
    if (typeof tokenResponse?.token === "string") return tokenResponse.token;
    if (typeof tokenResponse?.data?.token === "string") return tokenResponse.data.token;
    if (typeof tokenResponse?.data?.data?.token === "string") {
      return tokenResponse.data.data.token;
    }

    return "";
  };

  const getBlockSubscriptionId = (s) => {
    return s?.id ?? s?.block_subscription_id ?? s?.blockSubscriptionId ?? "";
  };

  const isPriceSaving = (subscriptionId) => {
    return !!savingPriceMap[String(subscriptionId)];
  };

  const setPriceSaving = (subscriptionId, saving) => {
    setSavingPriceMap((prev) => ({
      ...prev,
      [String(subscriptionId)]: saving,
    }));
  };

  const patchSubscriptionPrice = (subscriptionId, newPrice) => {
    setSubscriptions((prev) =>
      prev.map((row) =>
        String(getBlockSubscriptionId(row)) === String(subscriptionId)
          ? {
            ...row,
            price: newPrice,
          }
          : row
      )
    );
  };

  const updateBlockSubscriptionPrice = async (item, newPrice) => {
    const subscriptionId = getBlockSubscriptionId(item);

    if (!subscriptionId) {
      throw new Error("Block subscription ID not found.");
    }

    const priceValue = Number(String(newPrice ?? "0").replace(/,/g, "").trim());

    if (!Number.isFinite(priceValue) || priceValue < 0) {
      throw new Error("Please enter a valid price.");
    }

    const token = await getTokenValue();

    if (!token) {
      throw new Error("Token not found.");
    }

    const conditionId = /^\d+$/.test(String(subscriptionId))
      ? Number(subscriptionId)
      : subscriptionId;

    const payload = {
      token,
      tablename: "block_subscription",
      conditions: [
        {
          id: conditionId,
        },
      ],
      updatedata: [
        {
          price: priceValue,
        },
      ],
    };

    const response = await axios.post(UPDATE_DYNAMIC_DATA_URL, payload, {
      headers,
    });

    if (response?.data?.statusCode !== 200) {
      throw new Error(response?.data?.message || "Price update failed.");
    }

    return response.data;
  };

  const handleSavePrice = async (item) => {
    const subscriptionId = getBlockSubscriptionId(item);

    if (!subscriptionId) {
      Swal.fire({
        icon: "error",
        title: "ID Missing",
        text: "Block subscription ID not found.",
        confirmButtonText: "OK",
      });
      return;
    }

    const currentPrice = getNetPaid(item);
    const draftPrice = priceDraftMap[subscriptionId] ?? currentPrice;

    const nextPrice = Number(String(draftPrice ?? "0").replace(/,/g, "").trim());

    if (!Number.isFinite(nextPrice) || nextPrice < 0) {
      Swal.fire({
        icon: "error",
        title: "Invalid Price",
        text: "Please enter a valid price.",
        confirmButtonText: "OK",
      });
      return;
    }

    if (currentPrice === nextPrice) {
      Swal.fire({
        icon: "info",
        title: "No Changes",
        text: "Price is already the same.",
        confirmButtonText: "OK",
      });
      return;
    }

    const result = await Swal.fire({
      icon: "warning",
      title: "Update Price?",
      html: `
      <div style="text-align:center; line-height:1.7;">
        <div>Are you sure you want to update this block subscription price?</div>
        <div style="margin-top:10px;">
          <strong>Current:</strong> ${formatAED(currentPrice)}<br/>
          <strong>New:</strong> ${formatAED(nextPrice)}
        </div>
      </div>
    `,
      showCancelButton: true,
      confirmButtonText: "Yes, Update",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#6c757d",
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    setPriceSaving(subscriptionId, true);

    const previousPrice = currentPrice;

    // Optimistic UI update
    patchSubscriptionPrice(subscriptionId, nextPrice);

    try {
      await updateBlockSubscriptionPrice(item, nextPrice);

      setPriceDraftMap((prev) => ({
        ...prev,
        [subscriptionId]: nextPrice,
      }));

      await Swal.fire({
        icon: "success",
        title: "Updated Successfully",
        text: "Block subscription price has been updated successfully.",
        confirmButtonText: "OK",
        timer: 1800,
        timerProgressBar: true,
      });
    } catch (err) {
      // Rollback if API fails
      patchSubscriptionPrice(subscriptionId, previousPrice);

      setPriceDraftMap((prev) => ({
        ...prev,
        [subscriptionId]: previousPrice,
      }));

      Swal.fire({
        icon: "error",
        title: "Update Failed",
        text: err?.message || "Something went wrong while updating price.",
        confirmButtonText: "OK",
      });
    } finally {
      setPriceSaving(subscriptionId, false);
    }
  };

  const getUserId = (s) => s?.userid ?? s?.userId ?? "—";

  const getName = (s) => {
    const n = String(s?.studentFullname || "").trim();
    return n || s?.username || s?.email || "—";
  };

  const getStudentLogin = (s) => {
    const u = s?.username;
    if (u && String(u).trim() && String(u).toLowerCase() !== "null") {
      return String(u).trim();
    }
    return s?.email || "—";
  };

  const getPhoneText = (s) => {
    const raw = s?.phonenumber;
    if (!raw) return "—";
    const str = String(raw).trim();
    if (!str) return "—";
    return str.startsWith("+") ? str : `+${str}`;
  };

  const getPurchaseDateRaw = (s) => s?.createdAt || "";

  const toMoment = (d) => {
    if (!d) return null;
    const s0 = String(d).trim();

    const s1 = s0
      .replace(/\.([0-9]{3})[0-9]+$/, ".$1")
      .replace(/\.0{6}\b/, ".000");

    const isoish = s1.includes(" ") ? s1.replace(" ", "T") : s1;

    let m = moment(isoish, moment.ISO_8601, true);
    if (!m.isValid()) {
      m = moment(
        s1,
        ["YYYY-MM-DD HH:mm:ss.SSS", "YYYY-MM-DD HH:mm:ss", "YYYY-MM-DD"],
        true
      );
    }
    return m.isValid() ? m : null;
  };

  const getPurchaseDateText = (s) => {
    const m = toMoment(getPurchaseDateRaw(s));
    return m ? m.format("DD MMM YYYY") : "—";
  };

  const getPackageCredits = (s) => toNum(s?.package);
  const getUsedCredits = (s) => toNum(s?.used);
  const getRemainingCredits = (s) =>
    Math.max(getPackageCredits(s) - getUsedCredits(s), 0);

  const getValidTillMoment = (s) => {
    const m = toMoment(getPurchaseDateRaw(s));
    if (!m) return null;
    return m.clone().add(VALIDITY_DAYS, "days");
  };

  const getValidTillText = (s) => {
    const till = getValidTillMoment(s);
    return till ? till.format("DD MMM YYYY") : "—";
  };

  const getDaysLeftText = (s) => {
    const till = getValidTillMoment(s);
    if (!till) return "—";
    const today = moment().startOf("day");
    const endDay = till.clone().startOf("day");
    const diff = endDay.diff(today, "days");
    if (diff < 0) return "Expired";
    return `${diff} day${diff === 1 ? "" : "s"} left`;
  };

  const getNetPaid = (s) => toNum(s?.price);
  const getDiscountAmount = (s) => toNum(s?.discount);
  const getGrossAmount = (s) => getNetPaid(s) + getDiscountAmount(s);

  const isExpired = (s) => {
    const till = getValidTillMoment(s);
    if (!till) return false;
    return moment().startOf("day").isAfter(till.clone().startOf("day"));
  };

  const getStatus = (s) => {
    if (isExpired(s)) return "Expired";
    if (getRemainingCredits(s) === 0) return "Exhausted";
    return "Active";
  };

  const badgeClassByStatus = (status) => {
    const st = String(status || "").toLowerCase();
    if (st === "active") return "bg-success";
    if (st === "expired") return "bg-danger";
    if (st === "exhausted") return "bg-warning";
    return "bg-secondary";
  };

  const filteredData = useMemo(() => {
    const term = (searchTerm || "").toLowerCase().trim();

    return (subscriptions || []).filter((item) => {
      const fullText = `${getName(item)} ${getStudentLogin(item)} ${item?.code ?? ""
        } ${getPhoneText(item)} ${item?.parentemail || ""} ${item?.package ?? ""} ${item?.price ?? ""
        } ${item?.discount ?? ""} ${getStatus(item)}`
        .toLowerCase()
        .trim();

      const matchesSearch = term ? fullText.includes(term) : true;

      const matchesStatus =
        statusFilter === "" ||
        String(getStatus(item)).toLowerCase() ===
        String(statusFilter).toLowerCase();

      const cd = getPurchaseDateRaw(item);
      const itemDate = cd ? new Date(String(cd).replace(".000000", "")) : null;

      const fromDateMatch = startDate
        ? itemDate
          ? itemDate >= new Date(startDate)
          : false
        : true;

      const toDateMatch = endDate
        ? itemDate
          ? itemDate <= new Date(endDate)
          : false
        : true;

      return matchesSearch && matchesStatus && fromDateMatch && toDateMatch;
    });
  }, [subscriptions, searchTerm, statusFilter, startDate, endDate]);

  const summary = useMemo(() => {
    const total = filteredData.length;
    const active = filteredData.filter((x) => getStatus(x) === "Active").length;
    const remaining = filteredData.reduce(
      (sum, x) => sum + getRemainingCredits(x),
      0
    );

    const netCollected = filteredData.reduce(
      (sum, x) => sum + getNetPaid(x),
      0
    );
    const totalDiscount = filteredData.reduce(
      (sum, x) => sum + getDiscountAmount(x),
      0
    );
    const grossTotal = filteredData.reduce(
      (sum, x) => sum + getGrossAmount(x),
      0
    );

    return { total, active, remaining, netCollected, totalDiscount, grossTotal };
  }, [filteredData]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;

  const handleCreateBlockSubscriptionSuccess = () => {
    fetchBlockSubscriptions();
  };

  return (
    <>
      <div className="card h-100 p-0 radius-12">
        <style>{`
          .sub-muted { opacity: 0.75; font-size: 12px; }
          .sub-card {
            border: 1px solid rgba(0,0,0,0.08);
            border-radius: 12px;
            padding: 14px 16px;
            background: rgba(0,0,0,0.02);
          }
          [data-bs-theme="dark"] .sub-card,
          [data-theme="dark"] .sub-card,
          .dark .sub-card {
            border-color: rgba(255,255,255,0.12);
            background: rgba(255,255,255,0.04);
          }
          .thumb {
            width: 34px;
            height: 34px;
            border-radius: 8px;
            object-fit: cover;
            flex: 0 0 auto;
          }
          .name-cell {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 240px;
          }
          .sessions-wrap { min-width: 170px; }
          .sessions-text { font-size: 12px; opacity: 0.8; }
        `}</style>

        <div className="card-header border-bottom bg-base py-16 px-24 d-flex align-items-center flex-wrap gap-3 justify-content-between">
          <div className="d-flex align-items-center flex-wrap gap-3">
            <input
              type="text"
              className="form-control w-auto"
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />

            <input
              type="date"
              className="form-control w-auto"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
            />
            <input
              type="date"
              className="form-control w-auto"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
            />

            <select
              className="form-select form-select-sm w-auto"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">Status: All</option>
              <option value="Active">Active</option>
              <option value="Expired">Expired</option>
              <option value="Exhausted">Exhausted</option>
            </select>

            <button
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("");
                setStartDate("");
                setEndDate("");
                setCurrentPage(1);
              }}
              className="btn btn-outline-secondary btn-sm"
            >
              Reset Filters
            </button>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowCreateModal(true)}
            >
              Create Block Subscription
            </button>

            <button
              onClick={fetchBlockSubscriptions}
              className="btn btn-outline-primary btn-sm"
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="card-body p-24">
          {error ? <div className="alert alert-danger mb-3">{error}</div> : null}

          <div className="row g-3 mb-3">
            <div className="col-12 col-md-2">
              <div className="sub-card">
                <div className="sub-muted">Total</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>
                  {summary.total}
                </div>
              </div>
            </div>

            <div className="col-12 col-md-2">
              <div className="sub-card">
                <div className="sub-muted">Active</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>
                  {summary.active}
                </div>
              </div>
            </div>

            <div className="col-12 col-md-2">
              <div className="sub-card">
                <div className="sub-muted">Revenue</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>
                  {formatAED(summary.netCollected)}
                </div>
              </div>
            </div>

            <div className="col-12 col-md-2">
              <div className="sub-card">
                <div className="sub-muted">Discount Given</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>
                  {formatAED(summary.totalDiscount)}
                </div>
              </div>
            </div>

            <div className="col-12 col-md-2">
              <div className="sub-card">
                <div className="sub-muted">Gross Amount</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>
                  {formatAED(summary.grossTotal)}
                </div>
              </div>
            </div>

            <div className="col-12 col-md-2">
              <div className="sub-card">
                <div className="sub-muted">Remaining Credits</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>
                  {summary.remaining}
                </div>
              </div>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table bordered-table sm-table mb-0">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>S.L</th>
                  <th>Student Name</th>
                  <th>Student Email/Username</th>
                  <th>Package Credits</th>
                  <th>Used Credits</th>
                  <th>Remaining Credits</th>
                  <th>Grade Wise Base Amount</th>
                  <th>Discount</th>
                  <th>Paid</th>
                  <th>Promo Code</th>
                  <th>Contact No</th>
                  <th>Parent Email</th>
                  <th>Purchase Date</th>
                  <th>Valid Till</th>
                  <th>Days Left</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={16} className="text-center">
                      <div className="py-4">Loading...</div>
                    </td>
                  </tr>
                ) : currentItems.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="text-center">
                      <div className="py-4">
                        <div style={{ fontWeight: 700 }}>No records found.</div>
                        <div className="sub-muted">
                          Try clearing filters or search.
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentItems.map((item, index) => {
                    const totalCredits = getPackageCredits(item);
                    const usedCredits = getUsedCredits(item);
                    const pct =
                      totalCredits > 0
                        ? Math.min(
                          100,
                          Math.max(0, (usedCredits / totalCredits) * 100)
                        )
                        : 0;

                    return (
                      <tr key={`${getUserId(item)}-${index}`}>
                        <td>{indexOfFirstItem + index + 1}</td>

                        <td>
                          <div className="name-cell">
                            <img
                              className="thumb"
                              src={getImageSrc(item)}
                              alt="student"
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = FALLBACK_IMG;
                              }}
                            />

                            <div>
                              <div style={{ fontWeight: 600 }}>{getName(item)}</div>
                              <div className="sub-muted">
                                User ID: {getUserId(item)}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>{getStudentLogin(item)}</td>
                        <td>{getPackageCredits(item) || "—"}</td>

                        <td className="sessions-wrap">
                          <div style={{ fontWeight: 600 }}>
                            {totalCredits > 0
                              ? `${usedCredits}/${totalCredits} used`
                              : `${usedCredits}`}
                          </div>

                          {totalCredits > 0 ? (
                            <>
                              <div className="progress mt-1" style={{ height: 6 }}>
                                <div
                                  className="progress-bar"
                                  role="progressbar"
                                  style={{ width: `${pct}%` }}
                                  aria-valuenow={pct}
                                  aria-valuemin={0}
                                  aria-valuemax={100}
                                />
                              </div>
                              <div className="sessions-text mt-1">
                                Credits used
                              </div>
                            </>
                          ) : null}
                        </td>

                        <td style={{ fontWeight: 700 }}>
                          {getRemainingCredits(item)}
                        </td>

                        <td>{formatAED(getGrossAmount(item))}</td>
                        <td>{formatAED(getDiscountAmount(item))}</td>
                        <td style={{ minWidth: 190 }}>
                          {(() => {
                            const subscriptionId = getBlockSubscriptionId(item);
                            const saving = isPriceSaving(subscriptionId);

                            return (
                              <div>
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="form-control form-control-sm"
                                    style={{ width: 110 }}
                                    value={priceDraftMap[subscriptionId] ?? getNetPaid(item)}
                                    disabled={saving}
                                    onChange={(e) => {
                                      setPriceDraftMap((prev) => ({
                                        ...prev,
                                        [subscriptionId]: e.target.value,
                                      }));
                                    }}
                                  />

                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary"
                                    disabled={saving}
                                    onClick={() => handleSavePrice(item)}
                                  >
                                    {saving ? "Saving..." : "Save"}
                                  </button>
                                </div>

                                <div className="sub-muted mt-1">
                                  Current: {formatAED(getNetPaid(item))}
                                </div>
                              </div>
                            );
                          })()}
                        </td>

                        <td>{item?.code ?? "—"}</td>
                        <td>{getPhoneText(item)}</td>
                        <td>{item?.parentemail || "—"}</td>
                        <td>{getPurchaseDateText(item)}</td>
                        <td>{getValidTillText(item)}</td>
                        <td>{getDaysLeftText(item)}</td>

                        <td>
                          <span
                            className={`badge ${badgeClassByStatus(
                              getStatus(item)
                            )}`}
                          >
                            {getStatus(item)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="d-flex justify-content-between mt-3">
            <span>
              Showing {filteredData.length === 0 ? 0 : indexOfFirstItem + 1} to{" "}
              {Math.min(indexOfLastItem, filteredData.length)} of{" "}
              {filteredData.length} entries
            </span>

            <ul className="pagination">
              {Array.from({ length: totalPages }).map((_, i) => (
                <li
                  key={i}
                  className={`page-item ${currentPage === i + 1 ? "active" : ""}`}
                >
                  <button
                    onClick={() => setCurrentPage(i + 1)}
                    className="page-link"
                  >
                    {i + 1}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <CreateBlockSubscriptionModal
        show={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateBlockSubscriptionSuccess}
      />
    </>
  );
};

export default BlockSubscriptionsListLayer; 