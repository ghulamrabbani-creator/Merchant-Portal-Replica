"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Store,
  ChevronDown,
  SlidersHorizontal,
  Info,
} from "lucide-react";
import MetricCard from "@/components/ui/MetricCard";
import DateField from "@/components/ui/DateField";
import StatusDot from "@/components/ui/StatusDot";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import {
  chartSeries,
  topSchemes,
  transactionTypeBreakdown,
  payouts,
} from "@/lib/mock-data";
import { formatMoney, formatDate } from "@/lib/format";

const PIE_COLORS = ["#f2621f", "#f5945f", "#fac7a1"];

export default function DashboardPage() {
  const [tab, setTab] = useState<"transactions" | "paybylink">(
    "transactions"
  );
  const [range, setRange] = useState("25 Jul 2026 - 23 Aug 2026");
  const [activeMetric, setActiveMetric] = useState("amount");

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Welcome back, Demo Merchant
          </h1>
        </div>
        <button className="flex items-center gap-2 rounded-lg border border-border-color bg-brand-orange-light px-4 py-2 text-sm font-medium text-text-primary">
          <Store size={16} />
          All stores
          <ChevronDown size={14} />
        </button>
      </div>

      <div className="mb-5 flex gap-6 border-b border-border-color">
        <button
          onClick={() => setTab("transactions")}
          className={`border-b-2 pb-3 text-sm font-semibold ${
            tab === "transactions"
              ? "border-brand-orange text-brand-orange"
              : "border-transparent text-text-secondary"
          }`}
        >
          Transactions
        </button>
        <button
          onClick={() => setTab("paybylink")}
          className={`border-b-2 pb-3 text-sm font-semibold ${
            tab === "paybylink"
              ? "border-brand-orange text-brand-orange"
              : "border-transparent text-text-secondary"
          }`}
        >
          Pay by link
        </button>
      </div>

      <div className="mb-5 flex items-center justify-between">
        <DateField value={range} onChange={setRange} />
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-6">
        <div>
          <div className="flex gap-4">
            <MetricCard
              label="Transaction amount"
              value="110.88"
              suffix="AED"
              changePct={-23.2}
              active={activeMetric === "amount"}
              onClick={() => setActiveMetric("amount")}
            />
            <MetricCard
              label="Number of transactions"
              value="144"
              suffix="transactions"
              changePct={22.22}
              active={activeMetric === "count"}
              onClick={() => setActiveMetric("count")}
            />
            <MetricCard
              label="Average transactions"
              value="0.77"
              suffix="AED"
              changePct={-58.39}
              active={activeMetric === "avg"}
              onClick={() => setActiveMetric("avg")}
            />
          </div>

          <div className="mt-6 rounded-xl border border-border-color bg-card-bg p-5">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartSeries}>
                <defs>
                  <linearGradient id="today" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f2621f" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f2621f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#eef0f3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "#9599a6" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#9599a6" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="today"
                  stroke="#f2621f"
                  strokeWidth={2}
                  fill="url(#today)"
                  name="Last 30 days"
                />
                <Area
                  type="monotone"
                  dataKey="last"
                  stroke="#f5c2a1"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fill="none"
                  name="Last period"
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-2 flex items-center gap-6 text-xs text-text-secondary">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-brand-orange" /> Last 30 days
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 border-t border-dashed border-[#f5c2a1]" />
                Last period
              </span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-6">
            <div className="rounded-xl border border-border-color bg-card-bg p-5">
              <div className="text-base font-bold text-text-primary">
                Top stores
              </div>
              <div className="text-xs text-text-muted">
                Chart displays data for up to five selected stores
              </div>
              <div className="relative flex justify-center py-4">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Store A", value: 70 },
                        { name: "Store B", value: 25 },
                        { name: "Store C", value: 5 },
                      ]}
                      dataKey="value"
                      innerRadius={55}
                      outerRadius={80}
                      startAngle={90}
                      endAngle={-270}
                      strokeWidth={2}
                    >
                      {PIE_COLORS.map((c, i) => (
                        <Cell key={i} fill={c} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-xs text-text-muted">Total</div>
                  <div className="text-lg font-bold text-text-primary">
                    110.88 <span className="text-xs font-normal">AED</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                {["Acme Retail Demo LLC", "Acme Retail Demo LLC", "Acme Retail Demo LLC"].map(
                  (s, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-sm text-text-secondary"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: PIE_COLORS[i] }}
                      />
                      {s}
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border-color bg-card-bg p-5">
              <div className="text-base font-bold text-text-primary">
                Top schemes
              </div>
              <div className="text-xs text-text-muted">
                Chart displays data for up to five selected schemes
              </div>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={topSchemes} barSize={28}>
                  <CartesianGrid vertical={false} stroke="#eef0f3" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "#9599a6" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#9599a6" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip />
                  <Bar dataKey="value" radius={[6, 6, 6, 6]}>
                    {topSchemes.map((_, i) => (
                      <Cell
                        key={i}
                        fill={["#f2621f", "#c9cce3", "#d9dcec"][i]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-border-color bg-card-bg p-5">
            <div className="text-base font-bold text-text-primary">
              Transaction type
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={transactionTypeBreakdown}
                layout="vertical"
                margin={{ left: 40 }}
              >
                <CartesianGrid horizontal={false} stroke="#eef0f3" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12, fill: "#9599a6" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "#9599a6" }}
                  axisLine={false}
                  tickLine={false}
                  width={130}
                />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
                  {transactionTypeBreakdown.map((d, i) => (
                    <Cell
                      key={i}
                      fill={d.value < 0 ? "#f7bfa6" : "#f2621f"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border-color bg-card-bg p-5">
          <div className="mb-3 text-base font-bold text-text-primary">
            Recent payouts
          </div>
          <div className="flex flex-col gap-4">
            {payouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-text-primary">
                    {formatMoney(p.netPayout, p.currency)}
                  </div>
                  <div className="text-xs text-text-muted">
                    {formatDate(p.date)}
                  </div>
                </div>
                {p.id !== "p1" && <StatusDot status="Completed" />}
              </div>
            ))}
          </div>
          <Link
            href="/payouts"
            className="mt-4 block rounded-lg border border-brand-blue py-2 text-center text-sm font-semibold text-brand-blue"
          >
            See more
          </Link>
        </div>
      </div>
    </div>
  );
}
