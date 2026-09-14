import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, MessageSquare, Star, Clock, RefreshCw } from 'lucide-react';
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_BACKEND_URL || '',
});

const CARD_CLASS =
  'bg-white border border-gray-200 rounded-xl shadow-none';

const CHART_GRID = {
  strokeDasharray: '0',
  stroke: '#EEF0F3',
};

const AXIS_STYLE = {
  stroke: '#9CA3AF',
  fontSize: 11,
};

const TOOLTIP_STYLE = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: '8px',
  fontSize: '13px',
  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)',
};

const PURPLE = '#7C3AED';
const BAR_GRAY = '#A1A1AA';
const MUTED_GRAY = '#E5E7EB';

const AdvancedAnalytics = ({ chatbotId }) => {
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('7days');
  const [trendData, setTrendData] = useState(null);
  const [topQuestions, setTopQuestions] = useState(null);
  const [satisfaction, setSatisfaction] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [responseTimeTrend, setResponseTimeTrend] = useState(null);
  const [hourlyActivity, setHourlyActivity] = useState(null);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const [trends, questions, sat, perf, responseTrend, hourly] = await Promise.all([
        api.get(`/api/analytics/trends/${chatbotId}?period=${period}`).then((r) => r.data),
        api.get(`/api/analytics/top-questions/${chatbotId}`).then((r) => r.data),
        api.get(`/api/analytics/satisfaction/${chatbotId}`).then((r) => r.data),
        api.get(`/api/analytics/performance/${chatbotId}`).then((r) => r.data),
        api.get(`/api/analytics/response-time-trend/${chatbotId}?period=${period}`).then((r) => r.data),
        api.get(`/api/analytics/hourly-activity/${chatbotId}`).then((r) => r.data),
      ]);

      setTrendData(trends);
      setTopQuestions(questions);
      setSatisfaction(sat);
      setPerformance(perf);
      setResponseTimeTrend(responseTrend);
      setHourlyActivity(hourly);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [chatbotId, period]);

  const satisfactionPieData = satisfaction
    ? [
        { name: '5 Stars', value: satisfaction.rating_distribution[5] },
        { name: '4 Stars', value: satisfaction.rating_distribution[4] },
        { name: '3 Stars', value: satisfaction.rating_distribution[3] },
        { name: '2 Stars', value: satisfaction.rating_distribution[2] },
        { name: '1 Star', value: satisfaction.rating_distribution[1] },
      ].filter((item) => item.value > 0)
    : [];

  const satisfactionColors = [
    '#7C3AED',
    '#A78BFA',
    '#C4B5FD',
    '#E5E7EB',
    '#D1D5DB',
  ];

  const hasTrendData =
    trendData &&
    !(trendData.total_messages === 0 && trendData.total_conversations === 0);

  const hasPerformanceData =
    performance && performance.total_responses > 0;

  const hasResponseTrend =
    responseTimeTrend &&
    responseTimeTrend.data &&
    responseTimeTrend.data.length > 0 &&
    responseTimeTrend.data.some((d) => d.avg_response_time > 0);

  const hasHourlyData =
    hourlyActivity &&
    hourlyActivity.hourly_data &&
    hourlyActivity.total_messages > 0;

  const MetricCard = ({ label, value, detail, icon: Icon, iconClass = 'text-gray-500' }) => (
    <div className={`${CARD_CLASS} p-5 sm:p-6 min-h-[132px]`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium uppercase tracking-[0.12em] text-gray-500">
            {label}
          </p>
          <p className="mt-3 text-[28px] leading-none font-semibold tracking-tight text-gray-950">
            {value}
          </p>
          {detail && (
            <p className="mt-2 text-sm text-gray-500">
              {detail}
            </p>
          )}
        </div>
        {Icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
            <Icon className={`h-4 w-4 ${iconClass}`} strokeWidth={1.8} />
          </div>
        )}
      </div>
    </div>
  );

  const SectionCard = ({ title, eyebrow, children, className = '' }) => (
    <div className={`${CARD_CLASS} overflow-hidden ${className}`}>
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-6">
        <div>
          {eyebrow && (
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-gray-400">
              {eyebrow}
            </p>
          )}
          <h4 className="text-[15px] font-semibold tracking-tight text-gray-950">
            {title}
          </h4>
        </div>
      </div>
      <div className="p-5 sm:p-6">
        {children}
      </div>
    </div>
  );

  const EmptyState = ({ icon: Icon, title, description }) => (
    <div className="flex min-h-[250px] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
        <Icon className="h-5 w-5 text-gray-400" strokeWidth={1.7} />
      </div>
      <p className="text-sm font-medium text-gray-800">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm leading-5 text-gray-500">{description}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="h-2.5 w-28 rounded bg-gray-200" />
            <div className="h-8 w-56 rounded bg-gray-200" />
            <div className="h-3 w-72 rounded bg-gray-100" />
          </div>
          <div className="h-9 w-52 rounded-lg bg-gray-100" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className={`${CARD_CLASS} h-[132px] animate-pulse bg-white`}>
              <div className="p-6">
                <div className="h-2.5 w-24 rounded bg-gray-200" />
                <div className="mt-5 h-7 w-16 rounded bg-gray-200" />
                <div className="mt-3 h-2.5 w-28 rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 bg-[#F8F9FB] text-gray-950">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-purple-600">
            Workspace Analytics
          </p>
          <h3 className="mt-1.5 text-[30px] font-semibold leading-tight tracking-[-0.025em] text-gray-950">
            Advanced Analytics
          </h3>
          <p className="mt-1.5 text-sm text-gray-500">
            A clear view of agent activity, engagement, and performance.
          </p>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="flex flex-1 items-center rounded-lg border border-gray-200 bg-white p-0.5 sm:flex-none">
            {[
              ['7days', '7 Days'],
              ['30days', '30 Days'],
              ['90days', '90 Days'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPeriod(value)}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none ${
                  period === value
                    ? 'bg-gray-950 text-white'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={loadAnalytics}
            aria-label="Refresh analytics"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            <RefreshCw className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Avg Daily Messages"
          value={trendData?.avg_daily_messages?.toFixed(1) || 0}
          detail="Across selected period"
          icon={TrendingUp}
          iconClass="text-purple-600"
        />

        <MetricCard
          label="Total Conversations"
          value={trendData?.total_conversations || 0}
          detail="Conversations in selected period"
          icon={MessageSquare}
          iconClass="text-gray-500"
        />

        <MetricCard
          label="Satisfaction Rate"
          value={`${satisfaction?.satisfaction_percentage?.toFixed(1) || 0}%`}
          detail="Based on user feedback"
          icon={Star}
          iconClass="text-gray-500"
        />

        <MetricCard
          label="Avg Response Time"
          value={`${(performance?.avg_response_time_ms / 1000)?.toFixed(1) || 0}s`}
          detail="Average assistant response"
          icon={Clock}
          iconClass="text-gray-500"
        />
      </div>

      {/* Main Trend */}
      <SectionCard title="Message Volume Trends" eyebrow="Trend">
        {!hasTrendData ? (
          <EmptyState
            icon={MessageSquare}
            title="No message data available yet"
            description="Start chatting with your bot to see message trends appear here."
          />
        ) : (
          <ResponsiveContainer width="100%" height={270}>
            <LineChart data={trendData.data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid {...CHART_GRID} vertical={false} />
              <XAxis
                dataKey="date"
                {...AXIS_STYLE}
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                {...AXIS_STYLE}
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend
                wrapperStyle={{
                  fontSize: '12px',
                  paddingTop: '8px',
                  color: '#6B7280',
                }}
              />
              <Line
                type="monotone"
                dataKey="conversations"
                stroke={PURPLE}
                strokeWidth={2}
                name="Conversations"
                dot={false}
                activeDot={{ r: 4, fill: PURPLE }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="messages"
                stroke={BAR_GRAY}
                strokeWidth={1.8}
                name="Messages"
                dot={false}
                activeDot={{ r: 4, fill: BAR_GRAY }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="dashboard"
                stroke="#D4D4D8"
                strokeWidth={1.4}
                name="Dashboard"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="widget"
                stroke="#B8BBC2"
                strokeWidth={1.4}
                name="Widget"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="telegram"
                stroke="#A1A1AA"
                strokeWidth={1.3}
                name="Telegram"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="slack"
                stroke="#A1A1AA"
                strokeWidth={1.3}
                name="Slack"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="discord"
                stroke="#A1A1AA"
                strokeWidth={1.3}
                name="Discord"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="whatsapp"
                stroke="#A1A1AA"
                strokeWidth={1.3}
                name="WhatsApp"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="instagram"
                stroke="#A1A1AA"
                strokeWidth={1.3}
                name="Instagram"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="messenger"
                stroke="#A1A1AA"
                strokeWidth={1.3}
                name="Messenger"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="msteams"
                stroke="#A1A1AA"
                strokeWidth={1.3}
                name="MS Teams"
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      {/* Questions + Satisfaction */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard title="Top Asked Questions" eyebrow="Engagement">
          {!topQuestions || topQuestions.top_questions.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No questions yet"
              description="Questions will appear as users interact with your chatbot."
            />
          ) : (
            <ResponsiveContainer width="100%" height={270}>
              <BarChart
                data={topQuestions.top_questions.slice(0, 5)}
                margin={{ top: 8, right: 8, left: -16, bottom: 24 }}
              >
                <CartesianGrid {...CHART_GRID} vertical={false} />
                <XAxis
                  dataKey="question"
                  {...AXIS_STYLE}
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  angle={-15}
                  textAnchor="end"
                  height={70}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  {...AXIS_STYLE}
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar
                  dataKey="count"
                  fill={PURPLE}
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title="Satisfaction Distribution" eyebrow="Feedback">
          {!satisfaction || satisfactionPieData.length === 0 ? (
            <EmptyState
              icon={Star}
              title="No ratings yet"
              description="User satisfaction ratings will be displayed here."
            />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={satisfactionPieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={76}
                    innerRadius={44}
                    dataKey="value"
                    isAnimationActive={false}
                    paddingAngle={1}
                  >
                    {satisfactionPieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={satisfactionColors[index % satisfactionColors.length]}
                        stroke="#FFFFFF"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>

              <div className="mt-2 border-t border-gray-100 pt-4 text-center">
                <p className="text-sm text-gray-600">
                  Average Rating:{' '}
                  <span className="font-semibold text-gray-950">
                    {satisfaction.average_rating.toFixed(1)}/5.0
                  </span>
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Based on {satisfaction.total_ratings} ratings
                </p>
              </div>
            </>
          )}
        </SectionCard>
      </div>

      {/* Performance Metrics */}
      <SectionCard title="Performance Metrics" eyebrow="Response Performance">
        {!hasPerformanceData ? (
          <EmptyState
            icon={Clock}
            title="No performance data yet"
            description="Metrics will appear after the first responses."
          />
        ) : (
          <>
            <div className="grid grid-cols-1 divide-y divide-gray-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="pb-4 sm:pb-0 sm:pr-6">
                <p className="text-sm font-medium uppercase tracking-[0.1em] text-gray-500">
                  Fastest Response
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-950">
                  {(performance.fastest_response_ms / 1000).toFixed(2)}s
                </p>
              </div>

              <div className="py-4 sm:px-6 sm:py-0">
                <p className="text-sm font-medium uppercase tracking-[0.1em] text-gray-500">
                  Average Response
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-950">
                  {(performance.avg_response_time_ms / 1000).toFixed(2)}s
                </p>
              </div>

              <div className="pt-4 sm:pl-6 sm:pt-0">
                <p className="text-sm font-medium uppercase tracking-[0.1em] text-gray-500">
                  Slowest Response
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-950">
                  {(performance.slowest_response_ms / 1000).toFixed(2)}s
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-gray-100 pt-4">
              <p className="text-sm text-gray-500">
                Total Responses:{' '}
                <span className="font-medium text-gray-700">
                  {performance.total_responses}
                </span>
              </p>
            </div>
          </>
        )}
      </SectionCard>

      {/* Response Time + Hourly Activity */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard title="Response Time Trend" eyebrow="Performance">
          {!hasResponseTrend ? (
            <EmptyState
              icon={Clock}
              title="No response time data yet"
              description="Response times will be tracked as conversations happen."
            />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart
                  data={responseTimeTrend.data}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid {...CHART_GRID} vertical={false} />
                  <XAxis
                    dataKey="date"
                    {...AXIS_STYLE}
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    {...AXIS_STYLE}
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    tickLine={false}
                    axisLine={false}
                    label={{
                      value: 'Seconds',
                      angle: -90,
                      position: 'insideLeft',
                      fontSize: 11,
                      fill: '#9CA3AF',
                    }}
                    allowDecimals
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => [`${value}s`, 'Avg Response Time']}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg_response_time"
                    stroke={PURPLE}
                    strokeWidth={2}
                    name="Avg Response Time (s)"
                    dot={false}
                    activeDot={{ r: 4, fill: PURPLE }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>

              <p className="mt-2 text-center text-sm text-gray-500">
                Track how your agent's response speed changes over time.
              </p>
            </>
          )}
        </SectionCard>

        <SectionCard title="Hourly Activity Distribution" eyebrow="Activity">
          {!hasHourlyData ? (
            <EmptyState
              icon={TrendingUp}
              title="No hourly activity data yet"
              description="Activity patterns will appear as messages are sent."
            />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={hourlyActivity.hourly_data}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid {...CHART_GRID} vertical={false} />
                  <XAxis
                    dataKey="hour"
                    {...AXIS_STYLE}
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    {...AXIS_STYLE}
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => [`${value}`, 'Messages']}
                  />
                  <Bar
                    dataKey="messages"
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={false}
                  >
                    {hourlyActivity.hourly_data.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.messages > 0 ? PURPLE : MUTED_GRAY}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-2 border-t border-gray-100 pt-3 text-center text-sm text-gray-500">
                Peak hour:{' '}
                <span className="font-medium text-gray-800">
                  {hourlyActivity.peak_hour}:00
                </span>
                <span className="mx-1.5 text-gray-300">•</span>
                Total messages:{' '}
                <span className="font-medium text-gray-800">
                  {hourlyActivity.total_messages}
                </span>
              </div>
            </>
          )}
        </SectionCard>
      </div>
    </div>
  );
};

export default AdvancedAnalytics;
