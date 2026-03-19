import React, { useState, useEffect } from "react";
import { DS } from "../design/tokens";
import { Button, Card, MetricCard } from "../components/ui";
import { DeFybLogo, HealthScoreRing } from "../components/svg";
import { NotificationBell } from "../components/NotificationBell";
import { StageProgressBar, getStageMessage } from "../components/StageProgressBar";
import { SAMPLE_CLIENTS, STAGES } from "../data/constants";
import { supabase, isSupabaseConfigured } from "../supabase";

export const ClientPortal = ({ onBack, practiceId: propPracticeId }) => {
  const [tab, setTab] = useState("overview");
  const [practice, setPractice] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Get practice ID from URL or props
  const practiceId = propPracticeId || (() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("practice");
    }
    return null;
  })();

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured()) {
        // Fall back to sample data for demo
        setPractice(SAMPLE_CLIENTS[0]);
        setLoading(false);
        return;
      }

      if (!practiceId) {
        // No practice ID, show sample data
        setPractice(SAMPLE_CLIENTS[0]);
        setLoading(false);
        return;
      }

      try {
        // Fetch practice data
        const { data: practiceData, error: practiceError } = await supabase
          .from("practices")
          .select("*")
          .eq("id", practiceId)
          .single();

        if (practiceError) throw practiceError;

        // Transform to component format
        const transformed = {
          ...practiceData,
          stack: practiceData.ai_stack || [],
          score: practiceData.health_score,
          metrics: {
            docTime: practiceData.doc_time_current,
            docTimeBaseline: practiceData.doc_time_baseline,
            denialRate: practiceData.denial_rate_current,
            denialBaseline: practiceData.denial_rate_baseline,
            callRate: practiceData.call_answer_rate_current,
            callBaseline: practiceData.call_answer_rate_baseline,
            codingUplift: practiceData.coding_uplift_monthly,
            revenue: practiceData.revenue_recovered_monthly,
          },
        };
        setPractice(transformed);

        // Fetch client notifications
        const { data: notifData } = await supabase
          .from("notifications")
          .select("*")
          .eq("practice_id", practiceId)
          .eq("user_type", "client")
          .order("created_at", { ascending: false })
          .limit(10);

        setNotifications(notifData || []);
      } catch (err) {
        console.error("Error fetching practice:", err);
        setPractice(SAMPLE_CLIENTS[0]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [practiceId]);

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        color: DS.colors.textMuted,
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px", animation: "pulse 1.5s infinite" }}>⚡</div>
          Loading your portal...
        </div>
      </div>
    );
  }

  if (!practice) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Card style={{ textAlign: "center", maxWidth: "400px" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔒</div>
          <h2 style={{ fontFamily: DS.fonts.display, fontSize: "24px", marginBottom: "8px" }}>Portal Not Found</h2>
          <p style={{ color: DS.colors.textMuted, fontSize: "14px" }}>
            This portal link may be invalid or expired.
          </p>
          <Button onClick={onBack} style={{ marginTop: "20px" }}>← Back to site</Button>
        </Card>
      </div>
    );
  }

  const m = practice.metrics || {};
  const hasCurrentMetrics = m.docTime != null || m.denialRate != null || m.callRate != null;
  const stageMessage = getStageMessage(practice.stage);

  const hasPilot = ["assessment", "implementation"].includes(practice.stage) && practice.pilot_status && practice.pilot_status !== "not_started";

  const tabs = [
    { key: "overview", label: "Overview" },
    ...(hasPilot ? [{ key: "pilot", label: "Pilot Progress" }] : []),
    ...(hasCurrentMetrics ? [{ key: "metrics", label: "Metrics" }] : []),
    ...(practice.stack?.length > 0 ? [{ key: "stack", label: "Tool Stack" }] : []),
    { key: "updates", label: "Updates" },
  ];

  return (
    <div style={{ minHeight: "100vh" }}>
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px clamp(20px, 5vw, 80px)",
        background: `${DS.colors.bg}ee`, backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${DS.colors.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <DeFybLogo size={24} />
          <div style={{ width: "1px", height: "20px", background: DS.colors.border }} />
          <span style={{ fontSize: "14px", color: DS.colors.textMuted }}>{practice.name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {practiceId && <NotificationBell userType="client" />}
          <span onClick={onBack} style={{ fontSize: "13px", color: DS.colors.textMuted, cursor: "pointer" }}>Sign out</span>
        </div>
      </nav>

      <div style={{ padding: "80px clamp(20px, 5vw, 80px) 40px", maxWidth: "1100px", margin: "0 auto" }}>
        {/* STAGE PROGRESS */}
        <StageProgressBar currentStage={practice.stage} />

        {/* TABS */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "32px", borderBottom: `1px solid ${DS.colors.border}` }}>
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "10px 20px", background: "none", border: "none", cursor: "pointer",
              fontFamily: DS.fonts.body, fontSize: "14px", fontWeight: 500,
              color: tab === t.key ? DS.colors.shock : DS.colors.textMuted,
              borderBottom: tab === t.key ? `2px solid ${DS.colors.shock}` : "2px solid transparent",
              marginBottom: "-1px", transition: "all 0.2s",
            }}>{t.label}</button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {tab === "overview" && (
          <div className="fade-in">
            {/* Stage Message */}
            <Card style={{ marginBottom: "24px", display: "flex", alignItems: "center", gap: "20px" }}>
              <div style={{ fontSize: "40px" }}>{stageMessage.icon}</div>
              <div>
                <h2 style={{ fontFamily: DS.fonts.display, fontSize: "24px", marginBottom: "4px" }}>
                  {stageMessage.title}
                </h2>
                <p style={{ color: DS.colors.textMuted, fontSize: "14px" }}>{stageMessage.subtitle}</p>
              </div>
            </Card>

            {/* Health Score (only for managed) */}
            {practice.stage === "managed" && practice.score && (
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "40px", alignItems: "start", marginBottom: "32px" }}>
                <HealthScoreRing score={practice.score} size={160} />
                <div>
                  <h3 style={{ fontFamily: DS.fonts.display, fontSize: "22px", marginBottom: "16px" }}>
                    Practice Health
                  </h3>
                  {hasCurrentMetrics && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px" }}>
                      {m.docTime != null && (
                        <MetricCard small label="Doc Time" value={`${m.docTime} min`} sub={m.docTimeBaseline ? `was ${m.docTimeBaseline} min` : undefined} color={DS.colors.blue} />
                      )}
                      {m.denialRate != null && (
                        <MetricCard small label="Denial Rate" value={`${m.denialRate}%`} sub={m.denialBaseline ? `was ${m.denialBaseline}%` : undefined} color={m.denialRate < 6 ? DS.colors.vital : DS.colors.warn} />
                      )}
                      {m.callRate != null && (
                        <MetricCard small label="Call Answer" value={`${m.callRate}%`} sub={m.callBaseline ? `was ${m.callBaseline}%` : undefined} color={DS.colors.blue} />
                      )}
                      {m.codingUplift != null && m.codingUplift > 0 && (
                        <MetricCard small label="Coding Uplift" value={`$${(m.codingUplift / 1000).toFixed(0)}K`} sub="this month" color={DS.colors.vital} />
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Baseline captured (for assessment stage) */}
            {practice.stage === "assessment" && practice.doc_time_baseline && (
              <Card style={{ marginBottom: "24px" }}>
                <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "16px" }}>Baseline Captured</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
                  {practice.doc_time_baseline && <MetricCard small label="Doc Time" value={`${practice.doc_time_baseline} min`} color={DS.colors.blue} />}
                  {practice.denial_rate_baseline && <MetricCard small label="Denial Rate" value={`${practice.denial_rate_baseline}%`} color={DS.colors.warn} />}
                  {practice.call_answer_rate_baseline && <MetricCard small label="Call Answer" value={`${practice.call_answer_rate_baseline}%`} color={DS.colors.blue} />}
                </div>
                <p style={{ fontSize: "13px", color: DS.colors.textMuted, marginTop: "16px" }}>
                  We'll compare these baseline numbers to your metrics after implementation.
                </p>
              </Card>
            )}

            {/* Tool Stack Preview */}
            {practice.stack?.length > 0 && (
              <Card style={{ marginBottom: "24px" }}>
                <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "16px" }}>Your Tool Stack</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {practice.stack.map((tool, i) => (
                    <span key={i} style={{
                      padding: "8px 14px", borderRadius: DS.radius.md,
                      background: tool.status === "active" ? DS.colors.vitalDim : tool.status === "deploying" ? DS.colors.warnDim : DS.colors.bg,
                      border: `1px solid ${tool.status === "active" ? DS.colors.vital : tool.status === "deploying" ? DS.colors.warn : DS.colors.border}`,
                      fontSize: "13px",
                      color: tool.status === "active" ? DS.colors.vital : tool.status === "deploying" ? DS.colors.warn : DS.colors.textMuted,
                    }}>
                      {tool.name}
                      {tool.status !== "active" && <span style={{ fontSize: "10px", marginLeft: "6px", textTransform: "uppercase" }}>({tool.status})</span>}
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {/* Recent Updates */}
            {notifications.length > 0 && (
              <Card>
                <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "16px" }}>Recent Updates</div>
                <div style={{ display: "grid", gap: "8px" }}>
                  {notifications.slice(0, 5).map((notif, i) => (
                    <div key={i} style={{
                      display: "flex", gap: "12px", padding: "10px 0",
                      borderBottom: i < Math.min(notifications.length, 5) - 1 ? `1px solid ${DS.colors.border}` : "none",
                    }}>
                      <span style={{ fontSize: "14px" }}>
                        {notif.type === "stage_change" ? "🔄" : notif.type === "metric_update" ? "📈" : "📝"}
                      </span>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: "13px" }}>{notif.title}</div>
                        <div style={{ fontSize: "12px", color: DS.colors.textMuted }}>{notif.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* PILOT TAB */}
        {tab === "pilot" && hasPilot && (
          <div className="fade-in">
            <Card style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                <div>
                  <h3 style={{ fontFamily: DS.fonts.display, fontSize: "22px", marginBottom: "4px" }}>
                    Your Pilot Journey
                  </h3>
                  <p style={{ fontSize: "13px", color: DS.colors.textMuted }}>
                    {practice.pilot_start_date
                      ? `Started ${new Date(practice.pilot_start_date).toLocaleDateString()}`
                      : "Tracking your transformation progress"}
                  </p>
                </div>
                <div style={{
                  padding: "8px 16px", borderRadius: DS.radius.md,
                  background: practice.pilot_status === "completed" ? DS.colors.vitalDim : DS.colors.blueDim,
                  color: practice.pilot_status === "completed" ? DS.colors.vital : DS.colors.blue,
                  fontSize: "13px", fontWeight: 600,
                }}>
                  {practice.pilot_status === "completed" ? "Completed" : `Week ${practice.pilot_status?.replace("week", "")}`}
                </div>
              </div>

              {/* Week Progress Timeline */}
              <div style={{ display: "grid", gap: "16px" }}>
                {[
                  { key: "week1", num: 1, title: "Scribe Selection", desc: "Choose and set up your scribe", icon: "🎯" },
                  { key: "week2", num: 2, title: "EHR Integration", desc: "Connect to your electronic health record", icon: "🔗" },
                  { key: "week3", num: 3, title: "Full-Day Pilot", desc: "Test drive with real patients", icon: "🚀" },
                  { key: "week4", num: 4, title: "Coding Analysis", desc: "Review impact and make decision", icon: "📊" },
                ].map((week) => {
                  const checklist = practice.pilot_checklist?.[week.key] || {};
                  const checkableFields = Object.entries(checklist).filter(([k, v]) => typeof v === "boolean");
                  const completedCount = checkableFields.filter(([k, v]) => v).length;
                  const totalCount = checkableFields.length || 1;
                  const progress = Math.round((completedCount / totalCount) * 100);
                  const weekNum = parseInt(practice.pilot_status?.replace("week", "") || "0");
                  const isCurrentWeek = practice.pilot_status === week.key;
                  const isCompleted = progress === 100 || weekNum > week.num || practice.pilot_status === "completed";
                  const isUpcoming = weekNum < week.num && practice.pilot_status !== "completed";

                  return (
                    <div key={week.key} style={{
                      display: "grid", gridTemplateColumns: "50px 1fr auto", gap: "16px", alignItems: "center",
                      padding: "16px", borderRadius: DS.radius.md,
                      background: isCurrentWeek ? DS.colors.blueDim : DS.colors.bg,
                      border: `1px solid ${isCurrentWeek ? DS.colors.blue : isCompleted ? DS.colors.vital : DS.colors.border}`,
                      opacity: isUpcoming ? 0.5 : 1,
                    }}>
                      <div style={{
                        width: "44px", height: "44px", borderRadius: "50%", display: "flex",
                        alignItems: "center", justifyContent: "center", fontSize: "20px",
                        background: isCompleted ? DS.colors.vitalDim : isCurrentWeek ? DS.colors.blueDim : DS.colors.bgCard,
                        border: `2px solid ${isCompleted ? DS.colors.vital : isCurrentWeek ? DS.colors.blue : DS.colors.border}`,
                      }}>
                        {isCompleted ? "✓" : week.icon}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "2px" }}>
                          Week {week.num}: {week.title}
                        </div>
                        <div style={{ fontSize: "12px", color: DS.colors.textMuted }}>
                          {week.desc}
                        </div>
                        {isCurrentWeek && checklist.notes && (
                          <div style={{ fontSize: "12px", color: DS.colors.blue, marginTop: "6px", fontStyle: "italic" }}>
                            Note: {checklist.notes}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {isCompleted ? (
                          <span style={{ color: DS.colors.vital, fontSize: "12px", fontWeight: 600 }}>Complete</span>
                        ) : isCurrentWeek ? (
                          <div>
                            <div style={{ fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px" }}>{progress}%</div>
                            <div style={{ width: "80px", height: "4px", background: DS.colors.border, borderRadius: "2px", overflow: "hidden" }}>
                              <div style={{ width: `${progress}%`, height: "100%", background: DS.colors.blue }} />
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: DS.colors.textMuted, fontSize: "12px" }}>Upcoming</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* What's Next */}
            <Card>
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "12px" }}>What's Next?</div>
              {practice.pilot_status === "week1" && (
                <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>
                  <p>Your DeFyb team is helping you select the right scribe for your practice. Once selected, we'll create your account and get the mobile app installed.</p>
                  <p style={{ marginTop: "8px", color: DS.colors.blue }}>Expected: First generated note within the week</p>
                </div>
              )}
              {practice.pilot_status === "week2" && (
                <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>
                  <p>We're connecting your scribe to your EHR system. This ensures notes flow seamlessly into patient charts.</p>
                  <p style={{ marginTop: "8px", color: DS.colors.blue }}>Expected: Test patient notes syncing to EHR</p>
                </div>
              )}
              {practice.pilot_status === "week3" && (
                <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>
                  <p>Time for the real test! You'll use the scribe for a full day of patients. We'll be available for support throughout.</p>
                  <p style={{ marginTop: "8px", color: DS.colors.blue }}>Expected: Full day using AI, measuring time saved</p>
                </div>
              )}
              {practice.pilot_status === "week4" && (
                <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>
                  <p>We're analyzing the coding patterns from your pilot notes to identify potential E/M coding improvements. Then we'll meet to discuss the go/no-go decision.</p>
                  <p style={{ marginTop: "8px", color: DS.colors.blue }}>Expected: Coding analysis report and decision meeting</p>
                </div>
              )}
              {practice.pilot_status === "completed" && (
                <div style={{ fontSize: "13px" }}>
                  <p style={{ color: DS.colors.vital, fontWeight: 500 }}>Congratulations! Your pilot is complete.</p>
                  <p style={{ marginTop: "8px", color: DS.colors.textMuted }}>Based on the results, your DeFyb team will work with you on the next steps for full implementation.</p>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* METRICS TAB */}
        {tab === "metrics" && hasCurrentMetrics && (
          <div className="fade-in">
            {/* Before/After Comparison */}
            <Card style={{ marginBottom: "24px" }}>
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "20px" }}>Your Transformation</div>
              <div style={{ display: "grid", gap: "16px" }}>
                {m.docTime != null && m.docTimeBaseline != null && (
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <span style={{ fontSize: "14px", color: DS.colors.textMuted, width: "140px" }}>Documentation</span>
                    <span style={{ fontFamily: DS.fonts.mono, fontSize: "13px", color: DS.colors.danger, textDecoration: "line-through" }}>{m.docTimeBaseline} min/pt</span>
                    <span style={{ color: DS.colors.shock, fontSize: "16px" }}>→</span>
                    <span style={{ fontFamily: DS.fonts.mono, fontSize: "13px", color: DS.colors.vital, fontWeight: 600 }}>{m.docTime} min/pt</span>
                    <span style={{ fontSize: "12px", color: DS.colors.vital, marginLeft: "auto" }}>
                      {Math.round((1 - m.docTime / m.docTimeBaseline) * 100)}% faster
                    </span>
                  </div>
                )}
                {m.denialRate != null && m.denialBaseline != null && (
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <span style={{ fontSize: "14px", color: DS.colors.textMuted, width: "140px" }}>Denial Rate</span>
                    <span style={{ fontFamily: DS.fonts.mono, fontSize: "13px", color: DS.colors.danger, textDecoration: "line-through" }}>{m.denialBaseline}%</span>
                    <span style={{ color: DS.colors.shock, fontSize: "16px" }}>→</span>
                    <span style={{ fontFamily: DS.fonts.mono, fontSize: "13px", color: DS.colors.vital, fontWeight: 600 }}>{m.denialRate}%</span>
                    <span style={{ fontSize: "12px", color: DS.colors.vital, marginLeft: "auto" }}>
                      {(m.denialBaseline - m.denialRate).toFixed(1)}pp reduction
                    </span>
                  </div>
                )}
                {m.callRate != null && m.callBaseline != null && (
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <span style={{ fontSize: "14px", color: DS.colors.textMuted, width: "140px" }}>Calls Answered</span>
                    <span style={{ fontFamily: DS.fonts.mono, fontSize: "13px", color: DS.colors.danger, textDecoration: "line-through" }}>{m.callBaseline}%</span>
                    <span style={{ color: DS.colors.shock, fontSize: "16px" }}>→</span>
                    <span style={{ fontFamily: DS.fonts.mono, fontSize: "13px", color: DS.colors.vital, fontWeight: 600 }}>{m.callRate}%</span>
                    <span style={{ fontSize: "12px", color: DS.colors.vital, marginLeft: "auto" }}>
                      +{(m.callRate - m.callBaseline).toFixed(0)}pp
                    </span>
                  </div>
                )}
              </div>
            </Card>

            {/* Revenue Impact */}
            {(m.codingUplift || m.revenue) && (
              <Card>
                <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "16px" }}>Revenue Impact</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                  {m.codingUplift && m.codingUplift > 0 && (
                    <MetricCard label="Coding Uplift" value={`$${(m.codingUplift / 1000).toFixed(0)}K/mo`} color={DS.colors.vital} />
                  )}
                  {m.revenue && m.revenue > 0 && (
                    <MetricCard label="Revenue Recovered" value={`$${(m.revenue / 1000).toFixed(0)}K/mo`} color={DS.colors.vital} />
                  )}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* AI STACK TAB */}
        {tab === "stack" && practice.stack?.length > 0 && (
          <div className="fade-in">
            <div style={{ display: "grid", gap: "12px" }}>
              {practice.stack.map((tool, i) => (
                <Card key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "14px" }}>{tool.name}</div>
                    <div style={{ fontSize: "12px", color: DS.colors.textMuted }}>
                      {tool.status === "active" ? `Active since ${tool.since}` :
                       tool.status === "deploying" ? "Currently deploying..." :
                       `Planned for ${tool.since}`}
                    </div>
                  </div>
                  <span style={{
                    padding: "6px 14px", borderRadius: DS.radius.sm, fontSize: "11px", fontWeight: 600,
                    color: tool.status === "active" ? DS.colors.vital : tool.status === "deploying" ? DS.colors.warn : DS.colors.textMuted,
                    background: tool.status === "active" ? DS.colors.vitalDim : tool.status === "deploying" ? DS.colors.warnDim : DS.colors.bg,
                    textTransform: "uppercase", letterSpacing: "0.06em",
                  }}>{tool.status}</span>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* UPDATES TAB */}
        {tab === "updates" && (
          <div className="fade-in">
            {notifications.length === 0 ? (
              <Card style={{ textAlign: "center", padding: "40px" }}>
                <div style={{ fontSize: "32px", marginBottom: "12px" }}>📬</div>
                <p style={{ color: DS.colors.textMuted }}>No updates yet. Check back soon!</p>
              </Card>
            ) : (
              <div style={{ display: "grid", gap: "8px" }}>
                {notifications.map((notif, i) => (
                  <Card key={i} style={{ display: "flex", gap: "16px", padding: "16px 20px" }}>
                    <div style={{
                      fontFamily: DS.fonts.mono, fontSize: "11px", color: DS.colors.textDim,
                      whiteSpace: "nowrap", minWidth: "80px",
                    }}>
                      {new Date(notif.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: "13px", marginBottom: "4px" }}>{notif.title}</div>
                      <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>{notif.message}</div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
