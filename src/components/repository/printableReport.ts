import { escapeHtml } from './formatters';

export function buildPrintableReportHtml(
  title: string,
  summaryHtml: string,
  bodyHtml: string,
  footerText: string,
) {
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          @page {
            size: A4;
            margin: 18mm;
          }

          body {
            margin: 0;
            background: #ffffff;
            color: #0f172a;
            font-family: Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.55;
          }

          h1 {
            margin: 0 0 16px;
            font-size: 22pt;
            letter-spacing: 0.03em;
          }

          h2 {
            margin: 22px 0 4px;
            font-size: 14pt;
            page-break-after: avoid;
          }

          h3 {
            margin: 14px 0 4px;
            color: #475569;
            font-size: 9.5pt;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            page-break-after: avoid;
          }

          p {
            margin: 4px 0 8px;
          }

          .summary {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 20px;
            page-break-inside: avoid;
          }

          .result {
            border-top: 1px solid #cbd5e1;
            padding-top: 16px;
            margin-top: 18px;
            page-break-inside: auto;
          }

          .meta {
            color: #64748b;
            font-size: 9.5pt;
          }

          .badges {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin: 8px 0 10px;
          }

          .badge {
            display: inline-block;
            border-radius: 999px;
            padding: 3px 8px;
            font-size: 8.5pt;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }

          .badge.matched {
            background: #fef3c7;
            color: #92400e;
          }

          .badge.all {
            background: #dcfce7;
            color: #166534;
          }

          .badge.high,
          .badge.relevance.high {
            background: #d1fae5;
            color: #047857;
          }

          .badge.medium,
          .badge.relevance.medium {
            background: #e0f2fe;
            color: #0369a1;
          }

          .badge.low,
          .badge.relevance.low {
            background: #f1f5f9;
            color: #64748b;
          }

          .badge.sense,
          .badge.type {
            background: #e2e8f0;
            color: #334155;
          }

          .wordlist {
            width: 100%;
            border-collapse: collapse;
            margin: 8px 0 12px;
            font-size: 8.5pt;
          }

          .wordlist th,
          .wordlist td {
            border: 1px solid #cbd5e1;
            padding: 4px 6px;
            text-align: left;
            vertical-align: top;
          }

          .wordlist th {
            background: #f1f5f9;
            color: #475569;
          }

          .context {
            color: #334155;
          }

          .match {
            border-left: 4px solid #f59e0b;
            background: #fffbeb;
            padding: 8px 12px;
          }

          .answer {
            border-left: 4px solid #2563eb;
            background: #eff6ff;
            padding: 10px 12px;
            white-space: pre-wrap;
          }

          .evidence-image {
            max-width: 100%;
            max-height: 360px;
            display: block;
            margin: 8px 0;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
          }

          .term-highlight {
            background: #fde68a !important;
            color: #0f172a !important;
            border: 1px solid #f59e0b;
            border-radius: 3px;
            padding: 0 2px;
            font-weight: 700;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          @media print {
            .term-highlight {
              background: #fde68a !important;
              color: #0f172a !important;
              border: 1px solid #f59e0b;
              font-weight: 700;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }

          .footer {
            margin-top: 24px;
            border-top: 1px solid #cbd5e1;
            padding-top: 10px;
            color: #64748b;
            font-size: 9pt;
          }
        </style>
      </head>

      <body>
        <h1>${escapeHtml(title)}</h1>

        <div class="summary">${summaryHtml}</div>

        ${bodyHtml}

        <div class="footer">
          ${escapeHtml(footerText)}
        </div>

        <script>
          window.addEventListener('load', function () {
            window.focus();

            requestAnimationFrame(function () {
              setTimeout(function () {
                window.print();
              }, 500);
            });
          });
        </script>
      </body>
    </html>
  `;
}
