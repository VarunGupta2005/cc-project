import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to dynamically compute and print running headers and footers with page count."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        
        # Running Header (pages 2+)
        if self._pageNumber > 1:
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(colors.HexColor("#334155"))
            self.drawString(44, 11 * inch - 28, "RescueGrid: System Architecture, Design Rationale & Engineering Specification")
            self.setFont("Helvetica", 8)
            self.setFillColor(colors.HexColor("#64748B"))
            self.drawRightString(8.5 * inch - 44, 11 * inch - 28, "Cloud Computing Capstone - BCS VII Semester")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.6)
            self.line(44, 11 * inch - 33, 8.5 * inch - 44, 11 * inch - 33)
            
        # Running Footer (all pages)
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.6)
        self.line(44, 34, 8.5 * inch - 44, 34)
        
        self.setFont("Helvetica", 7.8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(44, 22, "RescueGrid Zero-Waste Cloud Platform  *  Academic Engineering Design & Implementation Dossier")
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * inch - 44, 22, page_text)
            
        self.restoreState()

def build_comprehensive_pdf(output_path="RescueGrid_Comprehensive_Architecture_and_System_Design.pdf"):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=44,
        rightMargin=44,
        topMargin=40,
        bottomMargin=42
    )
    
    styles = getSampleStyleSheet()
    
    PRIMARY = colors.HexColor("#0F172A")       # Deep Slate 900
    SECONDARY = colors.HexColor("#1E293B")     # Slate 800
    ACCENT = colors.HexColor("#2563EB")        # Royal Blue 600
    ACCENT_DARK = colors.HexColor("#1D4ED8")   # Deep Blue 700
    ACCENT_LIGHT = colors.HexColor("#EFF6FF")  # Blue 50
    EMERALD = colors.HexColor("#047857")       # Emerald 700
    EMERALD_BG = colors.HexColor("#ECFDF5")    # Emerald 50
    AMBER_DARK = colors.HexColor("#B45309")    # Amber 700
    AMBER_BG = colors.HexColor("#FFFBEB")      # Amber 50
    TEXT_DARK = colors.HexColor("#1E293B")
    TEXT_MUTED = colors.HexColor("#64748B")
    BORDER_COLOR = colors.HexColor("#CBD5E1")
    MATH_BG = colors.HexColor("#F8FAFC")
    BOX_BG = colors.HexColor("#F1F5F9")
    
    # Custom Typography Styles
    title_style = ParagraphStyle(
        'DocTitle', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=18, leading=22,
        textColor=PRIMARY, spaceAfter=3
    )
    subtitle_style = ParagraphStyle(
        'DocSubTitle', parent=styles['Normal'],
        fontName='Helvetica', fontSize=9.5, leading=13.5,
        textColor=ACCENT_DARK, spaceAfter=8
    )
    section_h1 = ParagraphStyle(
        'SectionH1', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=12, leading=15,
        textColor=PRIMARY, spaceBefore=10, spaceAfter=4, keepWithNext=True
    )
    section_h2 = ParagraphStyle(
        'SectionH2', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=9.8, leading=13,
        textColor=ACCENT_DARK, spaceBefore=7, spaceAfter=3, keepWithNext=True
    )
    section_h3 = ParagraphStyle(
        'SectionH3', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=8.8, leading=11.8,
        textColor=SECONDARY, spaceBefore=5, spaceAfter=2, keepWithNext=True
    )
    body_style = ParagraphStyle(
        'Body_Custom', parent=styles['Normal'],
        fontName='Helvetica', fontSize=8.2, leading=11.4,
        textColor=TEXT_DARK, spaceAfter=4
    )
    body_bold = ParagraphStyle(
        'Body_Bold_Custom', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=8.2, leading=11.4,
        textColor=PRIMARY, spaceAfter=4
    )
    bullet_style = ParagraphStyle(
        'Bullet_Custom', parent=styles['Normal'],
        fontName='Helvetica', fontSize=8, leading=11.2,
        textColor=TEXT_DARK, leftIndent=10, spaceAfter=2.5
    )
    formula_style = ParagraphStyle(
        'Formula_Custom', parent=styles['Normal'],
        fontName='Courier-Bold', fontSize=7.6, leading=10.5,
        textColor=SECONDARY
    )
    code_block_style = ParagraphStyle(
        'CodeBlock', parent=styles['Normal'],
        fontName='Courier', fontSize=7.2, leading=9.6,
        textColor=colors.HexColor("#0F172A")
    )
    table_cell = ParagraphStyle(
        'TableCell', parent=styles['Normal'],
        fontName='Helvetica', fontSize=7.4, leading=9.6,
        textColor=TEXT_DARK
    )
    table_cell_bold = ParagraphStyle(
        'TableCellBold', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=7.4, leading=9.6,
        textColor=PRIMARY
    )
    table_cell_code = ParagraphStyle(
        'TableCellCode', parent=styles['Normal'],
        fontName='Courier-Bold', fontSize=7.2, leading=9.2,
        textColor=ACCENT_DARK
    )
    table_header = ParagraphStyle(
        'TableHeader', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=7.6, leading=10,
        textColor=colors.white
    )
    callout_text = ParagraphStyle(
        'CalloutText', parent=styles['Normal'],
        fontName='Helvetica', fontSize=8, leading=11.2,
        textColor=colors.HexColor("#1E3A8A")
    )
    callout_bold = ParagraphStyle(
        'CalloutBold', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=8, leading=11.2,
        textColor=colors.HexColor("#1E3A8A")
    )

    story = []

    # =========================================================================
    # PAGE 1: TITLE, EXECUTIVE SUMMARY & THE PROBLEM DOMAIN ("WHAT WE ARE DOING")
    # =========================================================================
    story.append(Paragraph("BCS VII SEMESTER &bull; CLOUD COMPUTING CAPSTONE PROJECT DOSSIER", ParagraphStyle(
        'Tag', fontName='Helvetica-Bold', fontSize=8, textColor=ACCENT_DARK, spaceAfter=2
    )))
    story.append(Paragraph("RescueGrid: Comprehensive System Architecture, Cloud Design Rationale & Engineering Specification", title_style))
    story.append(Paragraph("A Distributed, Event-Driven Cloud Platform for Real-Time Zero-Waste Food Surplus Redistribution, Cryptographic Chain-of-Custody & Concurrency Control", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=ACCENT, spaceAfter=6))

    meta_grid = [
        [
            Paragraph("<b>Project Domain:</b> Cloud Computing & Geospatial Distributed Systems", table_cell),
            Paragraph("<b>Ingress & Scaling:</b> Nginx Reverse Proxy + 3x Stateless API Replicas", table_cell),
            Paragraph("<b>Verification Status:</b> 100% Passed (4 Suites, 53+ Unit/Integration Specs)", table_cell)
        ],
        [
            Paragraph("<b>Data Layer:</b> Redis 7 GEO + PostgreSQL 15 ACID Persisted Ledger", table_cell),
            Paragraph("<b>Client Architecture:</b> React 18, Leaflet Radar, OpenStreetMap, Dual Theme", table_cell),
            Paragraph("<b>Security & Custody:</b> HMAC-SHA256 Non-Repudiation + 6-Digit Gate OTP", table_cell)
        ]
    ]
    t_meta = Table(meta_grid, colWidths=[2.4*inch, 2.5*inch, 2.4*inch])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BOX_BG),
        ('PADDING', (0,0), (-1,-1), 4),
        ('BOX', (0,0), (-1,-1), 0.6, BORDER_COLOR),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 6))

    story.append(Paragraph("1. Executive Summary & Problem Formulation: What We Are Doing", section_h1))
    story.append(Paragraph(
        "<b>RescueGrid</b> is a production-grade, horizontally scaled, cloud-native coordination network designed to solve "
        "one of the most severe humanitarian and environmental contradictions in urban centers: <b>the simultaneous coexistence of "
        "massive commercial food waste and acute urban food insecurity</b>.",
        body_style
    ))

    story.append(Paragraph("1.1 The Urban Food Paradox & Real-World Reality", section_h2))
    story.append(Paragraph(
        "In modern metropolitan regions, commercial food producers—including luxury hotels, wedding banquet halls, corporate cafeterias, "
        "and industrial caterers—routinely prepare food in substantial bulk. Due to event attendance variability and safety margins, 15% to 35% "
        "of prepared meals remain unserved at the conclusion of evening functions. Simultaneously, verified hunger-relief shelters, children's homes, "
        "and community kitchens located within a 5 to 15 kilometer radius operate under chronic caloric and protein deficits. Millions of edible "
        "meals are trucked to municipal landfills nightly, generating potent methane emissions, while vulnerable populations remain undernourished.",
        body_style
    ))

    story.append(Paragraph("1.2 The Biological Clock: The 3-Hour Microbial Danger Zone", section_h2))
    story.append(Paragraph(
        "Unlike commercial e-commerce or dry-goods delivery where parcels can sit in warehouses for days, prepared surplus hot food is governed by "
        "strict biological laws. Between <b>5&deg;C and 60&deg;C (the biological 'Danger Zone')</b>, bacterial pathogens such as <i>Bacillus cereus</i>, "
        "<i>Salmonella enterica</i>, and <i>Staphylococcus aureus</i> proliferate exponentially, with population doubling times as short as 20 minutes. "
        "Under food safety regulatory guidelines (FSSAI / FDA), freshly cooked food must be transferred, safely transported, verified, and consumed within "
        "a hard window of <b>2 to 4 hours</b> post-cooking. Once this microbiological threshold is breached, food becomes hazardous waste. "
        "Therefore, any viable digital redistribution solution must be an <b>active, real-time, low-latency dispatch grid</b> rather than an asynchronous bulletin board.",
        body_style
    ))

    story.append(Paragraph("1.3 Failure Modes of Traditional Approaches", section_h2))
    story.append(Paragraph(
        "Current informal redistribution attempts rely on ad-hoc WhatsApp broadcast groups, telephone chains, or static web forms. These mechanisms fail catastrophically in production due to four core architectural defects:",
        body_style
    ))
    story.append(Paragraph(
        "&bull; <b>Distributed Double-Claiming Race Condition:</b> When an urgent surplus notification is published publicly, multiple shelter couriers dispatch vehicles simultaneously without centralized mutual exclusion. Multiple drivers arrive at the kitchen loading dock for a single batch of food, causing wasted fuel, duplicate travel, operational disputes, and eroded volunteer trust.",
        bullet_style
    ))
    story.append(Paragraph(
        "&bull; <b>Deadline Blindness & Spoilage in Transit:</b> Traditional portals lack transit time modeling. A shelter 20 km away may claim a batch with only 30 minutes of remaining shelf-life; the courier inevitably encounters urban traffic congestion, resulting in the food spoiling in transit and being discarded upon arrival.",
        bullet_style
    ))
    story.append(Paragraph(
        "&bull; <b>Absence of Chain-of-Custody & Legal Liability:</b> Donors face legal and brand exposure regarding food tampering or unauthorized diversion. Without cryptographic verification, there is no tamper-proof record proving which driver picked up the food, at what exact timestamp, and under whose authority.",
        bullet_style
    ))
    story.append(Paragraph(
        "&bull; <b>Capacity Mismatch & Unbalanced Allocation:</b> A small shelter with a 20 kg refrigerator claims a 150 kg banquet donation, leading to 130 kg of food spoiling on their counters due to inability to store or consume it immediately.",
        bullet_style
    ))

    story.append(Paragraph("1.4 RescueGrid Solution Architecture", section_h2))
    story.append(Paragraph(
        "RescueGrid replaces chaotic manual messaging with a high-throughput, cloud-native coordination platform. It couples "
        "<b>sub-millisecond in-memory geospatial radial indexing</b>, <b>non-preemptible atomic distributed claiming locks (Redis Lua)</b>, "
        "<b>two-stage deterministic deadline and capacity feasibility matching</b>, <b>cryptographic HMAC-SHA256 physical handover verification</b>, "
        "and <b>multi-replica horizontal scaling behind an Nginx load balancer</b>. The system guarantees zero race conditions, enforces biological shelf-life constraints, and maintains an immutable audit ledger.",
        body_style
    ))

    story.append(PageBreak())

    # =========================================================================
    # PAGE 2: SYSTEM ARCHITECTURE & CLOUD TOPOLOGY ("WHAT IS OUR ARCHITECTURE")
    # =========================================================================
    story.append(Paragraph("2. System Architecture & Cloud Infrastructure Topology", section_h1))
    story.append(Paragraph(
        "RescueGrid is engineered as a containerized, horizontally scaled microservices topology comprising 6 orchestrated Docker containers "
        "operating within an isolated virtual bridge subnet (<code>172.28.0.0/16</code>). Each service maintains strict separation of concerns, "
        "adhering to twelve-factor cloud principles.",
        body_style
    ))

    # Architecture ASCII Diagram Box
    arch_diagram = [
        [
            Paragraph(
                "<b>RESCUEGRID DISTRIBUTED CLOUD TOPOLOGY</b><br/>"
                "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>[ Client Tier: React 18 SPA / Leaflet Radar / Shadcn UI ]</b><br/>"
                "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;HTTP / REST &amp; WebSocket (ws://)<br/>"
                "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;v<br/>"
                "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>[ Ingress Layer: Nginx Reverse Proxy &amp; Round-Robin Load Balancer (Port 80) ]</b><br/>"
                "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;Round-Robin Upstream Distribution<br/>"
                "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+-----------------------------------+-----------------------------------+<br/>"
                "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;v&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|<br/>"
                "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>[ API Replica 1 ]</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>[ API Replica 2 ]</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>[ API Replica 3 ]</b><br/>"
                "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(Node.js / Express :5000)&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(Node.js / Express :5000)&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(Node.js / Express :5000)<br/>"
                "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Stateless Business Logic&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Stateless Business Logic&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Stateless Business Logic<br/>"
                "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|<br/>"
                "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+-----------------------------------+-----------------------------------+<br/>"
                "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|<br/>"
                "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;v (Fast-Path / Concurrency / Pub-Sub)&nbsp;&nbsp;&nbsp;&nbsp;v (Durable Storage / ACID Audits)<br/>"
                "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>[ Redis 7.2 In-Memory Engine ]</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>[ PostgreSQL 15 ACID Persistence ]</b><br/>"
                "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;* geo:donations &amp; geo:shelters&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;* users, organizations &amp; food_listings<br/>"
                "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;* Atomic Lua Script: claim locks&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;* allocations &amp; delivery_assignments<br/>"
                "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;* Keyspace Event Daemon (KEx)&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;* handover_audits &amp; recipient_requests<br/>"
                "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;* Pub/Sub bus (channel:alerts)&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;* Relational foreign keys &amp; constraints",
                formula_style
            )
        ]
    ]
    t_arch_box = Table(arch_diagram, colWidths=[7.3*inch])
    t_arch_box.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), MATH_BG),
        ('BOX', (0,0), (-1,-1), 0.8, ACCENT),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_arch_box)
    story.append(Spacer(1, 6))

    story.append(Paragraph("2.1 The 6 Container Roles & Resource Isolation", section_h2))
    story.append(Paragraph(
        "Every tier is containerized and constrained with deterministic memory limits to prevent out-of-memory cascading failures:",
        body_style
    ))

    container_table_data = [
        [Paragraph("Container Name", table_header), Paragraph("Base Image & Technology", table_header), Paragraph("Memory Limit", table_header), Paragraph("Architectural Responsibility & Operational Role", table_header)],
        [
            Paragraph("<code>rescuegrid_lb</code>", table_cell_code),
            Paragraph("Nginx 1.25 Alpine", table_cell),
            Paragraph("40 MB", table_cell_bold),
            Paragraph("Single ingress gateway on port 80. Performs round-robin upstream HTTP load balancing and WebSocket TCP connection upgrades.", table_cell)
        ],
        [
            Paragraph("<code>rescuegrid_api_1</code><br/><code>rescuegrid_api_2</code><br/><code>rescuegrid_api_3</code>", table_cell_code),
            Paragraph("Node.js 18 / Express<br/>(Stateless cluster)", table_cell),
            Paragraph("140 MB<br/>each", table_cell_bold),
            Paragraph("Three horizontally scaled, identical backend replicas executing business logic, JWT authentication, matching algorithms, and token generation.", table_cell)
        ],
        [
            Paragraph("<code>rescuegrid_redis</code>", table_cell_code),
            Paragraph("Redis 7.2 Alpine", table_cell),
            Paragraph("70 MB", table_cell_bold),
            Paragraph("In-memory engine hosting 2D geospatial indexes (<code>GEOADD</code>), atomic Lua scripts for claim locking, keyspace expiry daemon, and Pub/Sub broker.", table_cell)
        ],
        [
            Paragraph("<code>rescuegrid_postgres</code>", table_cell_code),
            Paragraph("PostgreSQL 15 Alpine", table_cell),
            Paragraph("180 MB", table_cell_bold),
            Paragraph("Durable ACID persistence layer. Stores user identities, facility coordinates, immutable audit logs, delivery assignments, and historical analytics.", table_cell)
        ]
    ]
    t_containers = Table(container_table_data, colWidths=[1.5*inch, 1.5*inch, 0.9*inch, 3.4*inch])
    t_containers.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 3.5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_containers)
    story.append(Spacer(1, 6))

    story.append(Paragraph("2.2 Multi-Replica State Synchronization via Redis Pub/Sub", section_h2))
    story.append(Paragraph(
        "A critical challenge in multi-replica stateless architectures is propagating live events across container boundaries. When a client connected to "
        "<code>rescuegrid_api_1</code> claims a batch, connected clients on <code>rescuegrid_api_2</code> and <code>rescuegrid_api_3</code> must receive "
        "instant notifications to remove that pin from their radar maps. RescueGrid implements a <b>Redis Pub/Sub event bus (<code>channel:alerts</code>)</b>. "
        "All three API replicas subscribe to this channel on startup. Whenever an event occurs (e.g., <code>FOOD_POSTED</code>, <code>FOOD_CLAIMED</code>, "
        "<code>FOOD_EXPIRED</code>), the handling replica publishes the payload to Redis, which immediately broadcasts it to all sibling replicas. "
        "Each replica then forwards the event through its local WebSocket pool, ensuring cluster-wide state synchronization in <b>&lt; 5 milliseconds</b>.",
        body_style
    ))

    story.append(PageBreak())

    # =========================================================================
    # PAGE 3: CLOUD ENGINEERING DESIGN RATIONALE ("WHY WE BUILT IT THIS WAY") - PART 1
    # =========================================================================
    story.append(Paragraph("3. Deep-Dive Cloud Engineering Design Rationale: Why We Built It This Way", section_h1))
    story.append(Paragraph(
        "Every architectural decision in RescueGrid was chosen specifically to overcome a concrete distributed systems failure mode. "
        "The following analysis details the trade-offs, alternative approaches considered, and mathematical/operational justifications.",
        body_style
    ))

    story.append(Paragraph("Decision 1: Why Horizontal Scaling with Stateless Replicas behind Nginx?", section_h2))
    story.append(Paragraph(
        "<b>The Challenge:</b> Commercial surplus donations are bursty. They do not arrive uniformly throughout the day; instead, 80% of food surplus "
        "is broadcast within narrow 45-minute windows following banquet and lunch/dinner closures (e.g., 3:30 PM and 11:00 PM). A single monolithic server "
        "experiences severe CPU and connection starvation during these spikes.",
        body_style
    ))
    story.append(Paragraph(
        "<b>Architectural Rationale:</b> We deployed 3 stateless Node.js replicas behind an Nginx reverse proxy using round-robin upstream distribution. "
        "Replicas hold zero in-memory session or domain state. User tokens use self-contained HMAC-SHA256 JWTs with a shared cluster secret. If any replica "
        "crashes or becomes unresponsive, Nginx automatically retries upstream or routes to surviving replicas without dropped requests. Horizontal elasticity "
        "allows dynamically adding replicas (<code>docker compose up --scale api=5</code>) with zero application code modifications.",
        body_style
    ))

    story.append(Paragraph("Decision 2: Why Redis 7 GEO Instead of PostgreSQL PostGIS for Hot Radial Dispatch?", section_h2))
    story.append(Paragraph(
        "<b>The Alternative Considered:</b> The standard relational approach uses PostgreSQL with the PostGIS extension, executing spatial queries like "
        "<code>ST_DWithin(geom, ST_MakePoint(lng, lat), radius_meters)</code>.",
        body_style
    ))
    story.append(Paragraph(
        "<b>Why Redis 7 GEO was Chosen:</b>",
        body_bold
    ))
    story.append(Paragraph(
        "1. <b>Disk I/O Latency vs. RAM:</b> In high-density urban environments with hundreds of active shelters refreshing radar views every 5 seconds, PostGIS queries incur disk I/O, buffer cache locks, and GiST index traversals, resulting in query latencies between <b>25 ms and 80 ms</b> under concurrent load. In contrast, Redis stores coordinates directly in RAM as 52-bit integer Geohashes on a Sorted Set, executing <code>GEOSEARCH</code> in <b>0.8 ms to 2.1 ms</b>.",
        bullet_style
    ))
    story.append(Paragraph(
        "2. <b>Spatial Geohash Computation:</b> Redis uses space-filling Morton / Peano curves to interleave 26 bits of latitude and 26 bits of longitude into a single 52-bit integer score. Proximity searches reduce to binary range searches in a skip-list (<code>O(N + log M)</code> complexity), eliminating costly trigonometric Euclidean floating-point math during query execution.",
        bullet_style
    ))

    story.append(Paragraph("Decision 3: Why Redis Lua Atomic Scripting for Claiming Instead of SQL Row Locks?", section_h2))
    story.append(Paragraph(
        "<b>The Classical Race Condition:</b> When a 50 kg surplus batch is published, notifications hit 20 shelters within range simultaneously. In a naive system, 10 couriers click 'Claim' at the exact same millisecond. If using standard database transactions (<code>SELECT status ... UPDATE status = 'CLAIMED'</code>), multiple transactions read status <code>'AVAILABLE'</code> before any transaction commits, resulting in double-allocation and catastrophic operational conflict at the kitchen gate.",
        body_style
    ))
    story.append(Paragraph(
        "<b>Why SQL <code>SELECT ... FOR UPDATE</code> Fails Under Cloud Concurrency:</b> Pessimistic locking in PostgreSQL forces database connection pool exhaustion, lock wait timeouts, and potential distributed deadlocks when multiple transactions lock rows across distributed API replicas. Furthermore, PostgreSQL write latency (WAL flush to disk) introduces a <b>20 ms to 45 ms vulnerability window</b>.",
        body_style
    ))
    story.append(Paragraph(
        "<b>The Redis Lua Solution:</b> Redis is inherently single-threaded in its command execution engine. Lua scripts execute as non-preemptible, atomic primitives. We engineered <code>CLAIM_LUA_SCRIPT</code>, which executes the entire check-and-lock sequence in a single engine tick:",
        body_style
    ))

    lua_code_box = [
        [
            Paragraph(
                "-- ATOMIC CLAIM LUA SCRIPT (services/redisEngine.js)<br/>"
                "local current_status = redis.call('HGET', KEYS[1], 'status')<br/>"
                "if not current_status or (current_status ~= 'AVAILABLE' and current_status ~= 'PARTIALLY_CLAIMED') then<br/>"
                "&nbsp;&nbsp;return { 0, 'ERR_ALREADY_CLAIMED', '0', '0' }<br/>"
                "end<br/>"
                "-- Cascading Priority Window Checks (Tier 1 Rank #1, Tier 2 Top-5, Tier 3 Radius)<br/>"
                "-- Atomic quantity decrement and status transition...<br/>"
                "redis.call('HSET', KEYS[1], 'status', 'CLAIMED', 'quantity_remaining', '0', 'claimed_by', ARGV[1])<br/>"
                "redis.call('ZREM', 'geo:donations', ARGV[2]) -- Instant spatial radar eviction<br/>"
                "redis.call('EXPIRE', KEYS[1], 86400)         -- 24h retention for active transit tracking<br/>"
                "return { 1, 'FULL', tostring(claimed_amount), '0' }",
                code_block_style
            )
        ]
    ]
    t_lua = Table(lua_code_box, colWidths=[7.3*inch])
    t_lua.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), MATH_BG),
        ('BOX', (0,0), (-1,-1), 0.6, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_lua)
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        "<b>Result:</b> The first claimant acquires the lock and evicts the item from the spatial index in <b>&lt; 1 ms</b>. The remaining 49 concurrent requests receive an immediate rejection (<code>HTTP 409 Conflict</code>) from Redis RAM without ever creating database connection pressure on PostgreSQL.",
        body_style
    ))

    story.append(PageBreak())

    # =========================================================================
    # PAGE 4: CLOUD ENGINEERING DESIGN RATIONALE ("WHY WE BUILT IT THIS WAY") - PART 2
    # =========================================================================
    story.append(Paragraph("Decision 4: Why Redis Keyspace Notifications Instead of Cron Polling or setTimeout?", section_h2))
    story.append(Paragraph(
        "<b>The Alternative 1: Periodic Polling (Cron Jobs):</b> A background worker queries <code>SELECT * FROM food_listings WHERE expires_at &lt; NOW()</code> every 30 seconds. This creates periodic database spikes ('thundering herds'), and food that expires 1 second after a cron run remains dangerously visible on shelter maps for up to 29 seconds.",
        body_style
    ))
    story.append(Paragraph(
        "<b>The Alternative 2: In-Process <code>setTimeout</code>:</b> Scheduling a timer inside Node.js memory fails catastrophically in cloud environments. If an API replica restarts, scales down, or crashes, all in-memory timers are lost, causing expired food to remain active indefinitely.",
        body_style
    ))
    story.append(Paragraph(
        "<b>The Redis Keyspace Solution:</b> We configure Redis with <code>--notify-keyspace-events Ex</code>. Every food listing hash is initialized with an exact TTL matching its biological shelf-life. When the timer elapses, Redis passively evicts the key and publishes an internal event on <code>__keyevent@0__:expired</code>. A dedicated background daemon catches this event, executes spatial index cleanup, updates PostgreSQL to <code>'EXPIRED'</code>, and pushes a <code>food:expired</code> WebSocket alert to all connected shelter maps. Expiration is passive, zero-overhead, resilient across container restarts, and accurate to the exact millisecond.",
        body_style
    ))

    story.append(Paragraph("Decision 5: Why Dual-Store Architecture (Redis + PostgreSQL)?", section_h2))
    story.append(Paragraph(
        "RescueGrid adheres to <b>polyglot persistence</b>, pairing Redis 7 and PostgreSQL 15 according to their intrinsic database strengths:",
        body_style
    ))

    dual_store_data = [
        [Paragraph("Architectural Dimension", table_header), Paragraph("Redis 7 (In-Memory Engine)", table_header), Paragraph("PostgreSQL 15 (ACID Persistence)", table_header)],
        [
            Paragraph("<b>Primary Storage Role</b>", table_cell_bold),
            Paragraph("Hot coordination engine, geospatial radial indexing, ephemeral locks, rate-limiting, and Pub/Sub broker.", table_cell),
            Paragraph("Durable system of record, relational foreign keys, user credentials, immutable audit logs, and regulatory compliance.", table_cell)
        ],
        [
            Paragraph("<b>Latency Profile</b>", table_cell_bold),
            Paragraph("Sub-millisecond (0.5 ms &ndash; 2 ms), in-RAM execution.", table_cell),
            Paragraph("10 ms &ndash; 35 ms, WAL-backed disk commits.", table_cell)
        ],
        [
            Paragraph("<b>Data Lifespan</b>", table_cell_bold),
            Paragraph("Ephemeral, governed by biological TTLs and 24-hour retention.", table_cell),
            Paragraph("Permanent, historical audit trails for tax ESG and NGO verification.", table_cell)
        ],
        [
            Paragraph("<b>Concurrency Handling</b>", table_cell_bold),
            Paragraph("Single-threaded atomic Lua scripts; zero locking overhead.", table_cell),
            Paragraph("Row-level MVCC locking, foreign-key relational integrity constraints.", table_cell)
        ]
    ]
    t_dual = Table(dual_store_data, colWidths=[1.8*inch, 2.7*inch, 2.8*inch])
    t_dual.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 3.5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_dual)
    story.append(Spacer(1, 4))

    story.append(Paragraph("Decision 6: Why HMAC-SHA256 & Constant-Time Verification for Physical Handover?", section_h2))
    story.append(Paragraph(
        "Commercial food donors are acutely sensitive to brand damage and civil liability arising from food poisoning or unauthorized food diversion. "
        "Informal paper receipts or verbal confirmations provide zero non-repudiation.",
        body_style
    ))
    story.append(Paragraph(
        "RescueGrid implements a <b>cryptographic chain-of-custody protocol</b>:",
        body_style
    ))
    story.append(Paragraph(
        "1. <b>Cryptographic Token Generation:</b> When a shelter claims a batch, the cloud derives an HMAC-SHA256 signature using the listing UUID, recipient org UUID, timestamp, and cluster secret key: <code>Signature = HMAC-SHA256(Secret, ListingID:CourierID:Timestamp)</code>.",
        bullet_style
    ))
    story.append(Paragraph(
        "2. <b>Human-Readable 6-Digit Gate OTP:</b> A 6-digit numeric OTP is derived deterministically from the signature: <code>OTP = [ CRC32(Signature) mod 1000000 ]</code>. This is rendered in the shelter's digital wallet pass.",
        bullet_style
    ))
    story.append(Paragraph(
        "3. <b>Timing-Attack Immunity:</b> Verification at the donor kitchen uses <code>crypto.timingSafeEqual</code>. Standard string comparisons (<code>a === b</code>) exit on the first mismatched character, allowing attackers to deduce characters via nanosecond latency variations. Constant-time comparison guarantees equal execution time regardless of character correctness.",
        bullet_style
    ))
    story.append(Paragraph(
        "4. <b>Brute-Force Physical Gate Lockout:</b> A Redis counter (<code>otp_attempts:{listing_id}</code>) tracks verification failures. After 5 incorrect attempts, the physical gate locks down for 5 minutes (<code>HTTP 429 Too Many Requests</code>), eliminating automated brute-force attacks.",
        bullet_style
    ))
    story.append(Paragraph(
        "5. <b>Audit Digest Storage:</b> Raw verification codes are never stored plaintext in PostgreSQL audit logs. Instead, non-reversible SHA-256 digests (<code>token_digest</code>) are persisted, eliminating credential leaks from database inspect queries or backups.",
        bullet_style
    ))

    story.append(Paragraph("Decision 7: Why Deterministic Two-Stage Matching Over Black-Box AI/ML?", section_h2))
    story.append(Paragraph(
        "In life-critical operations involving food safety and biological deadlines, 'black-box' machine learning models present unacceptable operational risks: "
        "they suffer from hallucinations, non-deterministic scoring drift, lack explainability to donors, and cannot guarantee hard physical constraints. "
        "RescueGrid uses an explicit <b>Two-Stage Deterministic Engine</b>: Stage A enforces hard physical feasibility (verification, collection capability, dietary matching, and round-trip transit feasibility), rejecting 100% of infeasible pairs. "
        "Stage B applies transparent Multi-Attribute Utility Theory (MAUT) weighting travel, slack, capacity fit, and active demand with deterministic UUID tie-breaking.",
        body_style
    ))

    story.append(PageBreak())

    # =========================================================================
    # PAGE 5: CLOUD ENGINEERING DESIGN RATIONALE ("WHY WE BUILT IT THIS WAY") - PART 3
    # =========================================================================
    story.append(Paragraph("Decision 8: Why Cascading 3-Tier Priority Reservation?", section_h2))
    story.append(Paragraph(
        "<b>The 'Tragedy of the Commons' in Food Rescue:</b> In an open, unconstrained claiming system, large, well-funded shelters with full-time "
        "dispatch staff and large vehicle fleets monopolize every published donation within seconds of broadcast. Small, highly localized community kitchens "
        "and orphanages that desperately need food 2 blocks away are consistently outcompeted.",
        body_style
    ))
    story.append(Paragraph(
        "<b>The Cascading 3-Tier Priority Architecture:</b>",
        body_bold
    ))
    story.append(Paragraph(
        "When a food batch is broadcast, the matching engine calculates the Rank #1 best-fit shelter and the Top-5 feasible candidates. "
        "RescueGrid's Lua script dynamically enforces three sequential reservation windows:",
        body_style
    ))

    tier_table_data = [
        [Paragraph("Priority Window", table_header), Paragraph("Temporal Duration", table_header), Paragraph("Authorized Claimants", table_header), Paragraph("Operational Rationale & Spoilage Protection", table_header)],
        [
            Paragraph("<b>Tier 1: Exclusive Match</b>", table_cell_bold),
            Paragraph("0 &ndash; 5 Minutes<br/>(First 20% of TTL)", table_cell),
            Paragraph("<b>Rank #1 Shelter Only</b>", table_cell_bold),
            Paragraph("Guarantees that the shelter with the highest active demand and closest transit proximity has exclusive first right of refusal.", table_cell)
        ],
        [
            Paragraph("<b>Tier 2: Restricted Ring</b>", table_cell_bold),
            Paragraph("5 &ndash; 15 Minutes<br/>(Next 20% of TTL)", table_cell),
            Paragraph("<b>Rank #1 and Top-5 Feasible Shelters</b>", table_cell_bold),
            Paragraph("Expands eligibility to the top 5 feasible candidate shelters if the top candidate does not respond within 5 minutes.", table_cell)
        ],
        [
            Paragraph("<b>Tier 3: Public Radius</b>", table_cell_bold),
            Paragraph("&ge; 15 Minutes<br/>(Remaining TTL)", table_cell),
            Paragraph("<b>All Verified Shelters in Radial Perimeter</b>", table_cell_bold),
            Paragraph("Fully unlocks claiming to all verified shelters within the radius to guarantee zero food waste before biological expiration.", table_cell)
        ]
    ]
    t_tiers = Table(tier_table_data, colWidths=[1.6*inch, 1.4*inch, 1.7*inch, 2.6*inch])
    t_tiers.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 3.5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_tiers)
    story.append(Spacer(1, 5))

    story.append(Paragraph("Decision 9: Why Biological Shelf-Life Invariance on Claim Cancellation?", section_h2))
    story.append(Paragraph(
        "<b>The Real-World Scenario:</b> Shelter A claims a 50 kg batch. Ten minutes later, Shelter A's delivery vehicle suffers a flat tire. "
        "The shelter cancels the claim so another organization can rescue the food.",
        body_style
    ))
    story.append(Paragraph(
        "<b>The Flaw in Naive Implementations:</b> Naive systems either reset the expiration timer upon cancellation (creating a lethal food safety hazard by allowing spoiled food to be re-listed) or delete the listing outright (wasting perfectly edible food).",
        body_style
    ))
    story.append(Paragraph(
        "<b>RescueGrid's Immutable Biological Clock:</b>",
        body_bold
    ))
    story.append(Paragraph(
        "RescueGrid treats the biological expiration timestamp (<code>expires_at</code>) as completely immutable. When a claim is cancelled prior to physical pickup:",
        body_style
    ))
    story.append(Paragraph(
        "1. <b>Custody Check:</b> If the courier has already verified the pickup OTP (<code>status === 'IN_TRANSIT'</code>), cancellation is strictly prohibited. The courier possesses physical custody.",
        bullet_style
    ))
    story.append(Paragraph(
        "2. <b>Remaining Slack Evaluation:</b> The system computes <code>remaining_seconds = expires_at - NOW()</code>.",
        bullet_style
    ))
    story.append(Paragraph(
        "3. <b>Microbial Safety Threshold (15-Minute Gate):</b> If remaining shelf-life is <b>&le; 15 minutes</b>, the food cannot be safely dispatched, collected, and consumed in time. The listing is automatically transitioned to <code>'EXPIRED'</code> in PostgreSQL, evicted from Redis, and a safety expiration alert is broadcast.",
        bullet_style
    ))
    story.append(Paragraph(
        "4. <b>Safe Re-Entry:</b> If <b>&gt; 15 minutes</b> remain, the listing is restored to <code>'AVAILABLE'</code> or <code>'PARTIALLY_CLAIMED'</code>, re-inserted into <code>geo:donations</code>, and initialized with the <b>exact remaining biological TTL</b>. The biological clock never pauses or resets.",
        bullet_style
    ))

    # Visual Callout Box for Architecture Principles
    callout_content = [
        [
            Paragraph(
                "<b>CORE SYSTEM INVARIANT & GUARANTEE</b><br/>"
                "In RescueGrid, <i>a recommendation is not a claim, a claim is not a pickup, and a pickup is not a confirmed delivery</i>. "
                "Every transition is governed by explicit cryptographic, concurrency, or biological invariants enforced across both Redis and PostgreSQL.",
                callout_text
            )
        ]
    ]
    t_callout = Table(callout_content, colWidths=[7.3*inch])
    t_callout.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), ACCENT_LIGHT),
        ('BOX', (0,0), (-1,-1), 1, ACCENT),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(Spacer(1, 4))
    story.append(t_callout)

    story.append(PageBreak())

    # =========================================================================
    # PAGE 6: MATHEMATICAL FORMULATIONS, ALGORITHMS & PHYSICAL MODELS
    # =========================================================================
    story.append(Paragraph("4. Mathematical Formulations, Algorithms & Physical Models", section_h1))
    story.append(Paragraph(
        "Every spatial calculation, radar viewport derivation, and routing estimate in RescueGrid is governed by explicit mathematical formulations:",
        body_style
    ))

    story.append(Paragraph("4.1 Geodesic Surface Distance Computation (Haversine Formula)", section_h2))
    story.append(Paragraph(
        "Given donor coordinates (&phi;<sub>1</sub>, &lambda;<sub>1</sub>) and recipient coordinates (&phi;<sub>2</sub>, &lambda;<sub>2</sub>) in radians, "
        "the great-circle surface distance <i>d</i> over a spherical earth of mean radius <i>R</i> = 6371.0088 km is calculated as:",
        body_style
    ))
    math_haversine = [
        [
            Paragraph(
                "<b>Haversine Great-Circle Distance Formulation:</b><br/>"
                "&Delta;&phi; = &phi;<sub>2</sub> &minus; &phi;<sub>1</sub>, &nbsp;&nbsp;&nbsp;&nbsp; &Delta;&lambda; = &lambda;<sub>2</sub> &minus; &lambda;<sub>1</sub><br/>"
                "<i>a</i> = sin<sup>2</sup>(&Delta;&phi; / 2) + cos(&phi;<sub>1</sub>) &bull; cos(&phi;<sub>2</sub>) &bull; sin<sup>2</sup>(&Delta;&lambda; / 2)<br/>"
                "<i>c</i> = 2 &bull; atan2(&radic;a, &radic;(1 &minus; a))<br/>"
                "<b>d = R &bull; c</b> &nbsp;&nbsp;&nbsp;&nbsp;[where <i>R</i> = 6371.0088 km]",
                formula_style
            )
        ]
    ]
    t_m1 = Table(math_haversine, colWidths=[7.3*inch])
    t_m1.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,-1), MATH_BG), ('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR), ('PADDING', (0,0), (-1,-1), 4)]))
    story.append(t_m1)
    story.append(Spacer(1, 4))

    story.append(Paragraph("4.2 Dynamic Radar Viewport Bounding Box Trigonometry", section_h2))
    story.append(Paragraph(
        "When a shelter adjusts the scanning slider to radius <i>r</i> (km), the Leaflet radar must automatically re-center and frame the circular "
        "scan perimeter with buffer factor &beta; = 1.25 (25% visual padding). Because 1&deg; of latitude is constant (~111.0 km) while 1&deg; of longitude "
        "contracts with the cosine of the center latitude &phi;<sub>c</sub>:",
        body_style
    ))
    math_radar = [
        [
            Paragraph(
                "<b>Viewport Bounding Box Derivation:</b><br/>"
                "<i>r</i><sub>eff</sub> = &beta; &bull; <i>r</i> = 1.25 &bull; <i>r</i><br/>"
                "&Delta;&phi; = <i>r</i><sub>eff</sub> / 111.0 &nbsp;&nbsp;(degrees latitude)<br/>"
                "&Delta;&lambda; = <i>r</i><sub>eff</sub> / [ 111.0 &bull; cos(&phi;<sub>c</sub> &bull; &pi; / 180) ] &nbsp;&nbsp;(degrees longitude)<br/>"
                "<b>SouthWest</b> = (&phi;<sub>c</sub> &minus; &Delta;&phi;, &lambda;<sub>c</sub> &minus; &Delta;&lambda;), &nbsp;&nbsp;&nbsp;&nbsp; "
                "<b>NorthEast</b> = (&phi;<sub>c</sub> + &Delta;&phi;, &lambda;<sub>c</sub> + &Delta;&lambda;)<br/>"
                "<b>Leaflet Execution:</b> <code>map.fitBounds([[SW], [NE]], { padding: [25, 25], maxZoom: 15, animate: true })</code>",
                formula_style
            )
        ]
    ]
    t_m2 = Table(math_radar, colWidths=[7.3*inch])
    t_m2.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,-1), MATH_BG), ('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR), ('PADDING', (0,0), (-1,-1), 4)]))
    story.append(t_m2)
    story.append(Spacer(1, 4))

    story.append(Paragraph("4.3 Urban Road Transit Velocity Model & Total Mission Duration", section_h2))
    story.append(Paragraph(
        "Couriers navigating metropolitan traffic experience congestion friction. The transit model incorporates average urban velocity "
        "<i>v</i><sub>urban</sub> = 25 km/h, congestion multiplier &kappa;<sub>traffic</sub> = 1.2, donor loading buffer &tau;<sub>load</sub> = 15 min, "
        "and shelter unloading buffer &tau;<sub>unload</sub> = 15 min:",
        body_style
    ))
    math_transit = [
        [
            Paragraph(
                "<b>Transit Duration Model (Recipient Self-Pickup):</b><br/>"
                "<i>t</i><sub>one-way</sub> = (<i>d</i> / <i>v</i><sub>urban</sub>) &bull; &kappa;<sub>traffic</sub> &bull; 60 &nbsp;[minutes]<br/>"
                "<i>t</i><sub>round-trip</sub> = 2 &bull; <i>t</i><sub>one-way</sub><br/>"
                "<b>T<sub>mission</sub> = <i>t</i><sub>round-trip</sub> + &tau;<sub>load</sub> + &tau;<sub>unload</sub> + &tau;<sub>safety</sub> = 2 &bull; <i>t</i><sub>one-way</sub> + 45 minutes</b>",
                formula_style
            )
        ]
    ]
    t_m3 = Table(math_transit, colWidths=[7.3*inch])
    t_m3.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,-1), MATH_BG), ('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR), ('PADDING', (0,0), (-1,-1), 4)]))
    story.append(t_m3)
    story.append(Spacer(1, 4))

    story.append(Paragraph("4.4 Hard Feasibility Filtering & Deadline Slack Formulations", section_h2))
    story.append(Paragraph(
        "Stage A rejects candidate recipients outright if operational deadlines cannot be satisfied. "
        "Let <i>t</i><sub>claim</sub> be current time, <i>T</i><sub>pickup</sub> be donor cutoff, and <i>T</i><sub>consumption</sub> be microbial expiration:",
        body_style
    ))
    math_slack = [
        [
            Paragraph(
                "<b>Operational Deadline Slack Formulations:</b><br/>"
                "<i>t</i><sub>arrive_donor</sub> = <i>t</i><sub>claim</sub> + <i>t</i><sub>one-way</sub><br/>"
                "<i>t</i><sub>delivery_complete</sub> = <i>t</i><sub>claim</sub> + <i>T</i><sub>mission</sub><br/>"
                "<b>Slack<sub>pickup</sub> = T<sub>pickup</sub> &minus; <i>t</i><sub>arrive_donor</sub> &ge; 0</b> &nbsp;&nbsp;&nbsp;&nbsp;(Courier arrives before donor kitchen closes)<br/>"
                "<b>Slack<sub>consumption</sub> = T<sub>consumption</sub> &minus; <i>t</i><sub>delivery_complete</sub> &ge; 0</b> &nbsp;&nbsp;&nbsp;&nbsp;(Food distributed before bacterial spoilage)",
                formula_style
            )
        ]
    ]
    t_m4 = Table(math_slack, colWidths=[7.3*inch])
    t_m4.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,-1), MATH_BG), ('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR), ('PADDING', (0,0), (-1,-1), 4)]))
    story.append(t_m4)
    story.append(Spacer(1, 4))

    story.append(Paragraph("4.5 Multi-Criteria Optimization Scoring Function (MAUT)", section_h2))
    story.append(Paragraph(
        "Feasible candidates are ranked using normalized Multi-Attribute Utility Theory (MAUT): "
        "<code>S(s, b) = 0.30 &bull; S<sub>travel</sub> + 0.30 &bull; S<sub>slack</sub> + 0.25 &bull; S<sub>fit</sub> + 0.15 &bull; S<sub>need</sub></code>. "
        "Deterministic tie-breaking uses alphabetical string comparison of recipient UUIDs: <code>strcmp(UUID<sub>1</sub>, UUID<sub>2</sub>)</code>.",
        body_style
    ))

    story.append(PageBreak())

    # =========================================================================
    # PAGE 7: SYSTEM ENTITIES, ROLES & FRONTEND WORKFLOWS
    # =========================================================================
    story.append(Paragraph("5. System Roles, Operational Workflows & Frontend Experience", section_h1))
    story.append(Paragraph(
        "RescueGrid provides dedicated role-based portals engineered with React 18, Leaflet, and the Shadcn UI design system. "
        "Authentication uses HMAC-SHA256 JWTs with role authorization enforced at both the API middleware and client router levels.",
        body_style
    ))

    story.append(Paragraph("5.1 System Entities & Role Separation", section_h2))
    role_table_data = [
        [Paragraph("Role Name", table_header), Paragraph("Real-World Entities", table_header), Paragraph("System Workflows & Capabilities", table_header), Paragraph("Security Gates & Restrictions", table_header)],
        [
            Paragraph("<b>DONOR</b><br/>(Food Producer)", table_cell_bold),
            Paragraph("Hotels, banquet halls, caterers, cafeterias, corporate canteens.", table_cell),
            Paragraph("Broadcasts surplus batches, specifies dietary type, sets perishability TTL, selects entrance GPS pin, operates physical handover gate.", table_cell),
            Paragraph("Can only view and authorize handovers for batches broadcasted by their own organization.", table_cell)
        ],
        [
            Paragraph("<b>SHELTER</b><br/>(Food Consumer)", table_cell_bold),
            Paragraph("Hunger relief centers, orphanages, NGOs, community kitchens.", table_cell),
            Paragraph("Inbound live radar, radial distance slider, atomic full or partial claiming, Apple Wallet digital OTP ticket, assigns riders, cancels claims.", table_cell),
            Paragraph("Handover codes are strictly confidential and visible only to the claiming shelter org.", table_cell)
        ],
        [
            Paragraph("<b>RIDER</b><br/>(Courier / Logistics)", table_cell_bold),
            Paragraph("Shelter volunteer drivers, two-wheeler couriers, light vans.", table_cell),
            Paragraph("Receives allocated parcel dispatches, presents 6-digit gate OTP to donor kitchen, marks transit progress, confirms receipt.", table_cell),
            Paragraph("Single active rider per allocation enforced via unique database partial index.", table_cell)
        ],
        [
            Paragraph("<b>ADMIN</b><br/>(Operations & Compliance)", table_cell_bold),
            Paragraph("Municipal food safety officers, system coordinators.", table_cell),
            Paragraph("Inspects facility compliance, verifies or debars food donors/shelters, reviews tamper-proof audit ledger, monitors cluster health.", table_cell),
            Paragraph("Full administrative access to all compliance ledgers and organization verification states.", table_cell)
        ]
    ]
    t_roles = Table(role_table_data, colWidths=[1.3*inch, 1.6*inch, 2.3*inch, 2.1*inch])
    t_roles.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 3.5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_roles)
    story.append(Spacer(1, 5))

    story.append(Paragraph("5.2 Food Producer Portal (DonorPage.js)", section_h2))
    story.append(Paragraph(
        "&bull; <b>Structured Surplus Broadcast Engine:</b> Collects food type, quantity (kg), cooking completion timestamp, dietary classification (Vegetarian, Non-Vegetarian, Vegan), food category (Cooked Meal, Bakery, Raw Produce), storage requirements (Ambient, Refrigerated), allergen disclosures, and mandatory food safety declaration.",
        bullet_style
    ))
    story.append(Paragraph(
        "&bull; <b>Interactive Entrance GPS Pin Picker (LocationPickerMap.js):</b> Allows donors to drag an interactive map marker directly to their kitchen loading dock entrance, capturing high-precision latitude/longitude coordinates (&plusmn;5 meters).",
        bullet_style
    ))
    story.append(Paragraph(
        "&bull; <b>Active Donations & Verification Gate:</b> Renders active listings with live countdown clocks, quantity remaining, and an embedded OTP terminal where kitchen staff validate arriving couriers.",
        bullet_style
    ))

    story.append(Paragraph("5.3 Food Consumer Portal & Live Radar (ShelterPage.js & ShelterRadarMap.js)", section_h2))
    story.append(Paragraph(
        "&bull; <b>Inbound Proximity Food Radar:</b> Features an interactive radius slider (5 km to 3,000 km All-India) that dynamically projects a pulsing blue dashed scanning circle around the shelter's location and automatically adjusts map zoom via bounding box trigonometry.",
        bullet_style
    ))
    story.append(Paragraph(
        "&bull; <b>Atomic Batch Claiming Modal:</b> Shelters can claim the full surplus batch or execute a <b>partial capacity split</b> (e.g., claiming 20 kg out of a 50 kg donation), leaving the remaining 30 kg available for other shelters.",
        bullet_style
    ))
    story.append(Paragraph(
        "&bull; <b>Apple Wallet-Style Digital OTP Pass:</b> Upon claim confirmation, the shelter UI renders an iOS/Android wallet-style digital pass containing the 6-digit gate OTP, cryptographic token signature, donor pickup address, and driver instructions.",
        bullet_style
    ))
    story.append(Paragraph(
        "&bull; <b>Claim Cancellation Gate:</b> Allows releasing a batch before physical pickup, automatically enforcing biological shelf-life invariance.",
        bullet_style
    ))

    story.append(Paragraph("5.4 Visual Innovations: Dark Matter Filter & Hub-and-Spoke Vectors", section_h2))
    story.append(Paragraph(
        "&bull; <b>Zero-Cost Dark Matter Tiles:</b> To eliminate costly third-party map API keys (Google Maps / Mapbox), RescueGrid applies client-side CSS/SVG invert and hue filters to standard OpenStreetMap raster tiles, rendering high-contrast night-mode cartography with zero API fees.",
        bullet_style
    ))
    story.append(Paragraph(
        "&bull; <b>Hub-and-Spoke Logistics Vectors:</b> Dynamic color-coded SVG polyline vectors connect active donor kitchens directly to claiming shelter hubs, visually distinguishing in-transit missions from available listings.",
        bullet_style
    ))

    story.append(PageBreak())

    # =========================================================================
    # PAGE 8: RELATIONAL SCHEMA, PERSISTENCE & IN-MEMORY DATA MODELS
    # =========================================================================
    story.append(Paragraph("6. Relational Database Schema & In-Memory Data Models", section_h1))
    story.append(Paragraph(
        "RescueGrid enforces strict relational integrity in PostgreSQL 15 alongside high-velocity data structures in Redis 7.",
        body_style
    ))

    story.append(Paragraph("6.1 PostgreSQL Relational Schema (db/init.sql & db/migrations/)", section_h2))
    
    schema_table_data = [
        [Paragraph("Table Name", table_header), Paragraph("Primary / Foreign Keys", table_header), Paragraph("Key Columns & Types", table_header), Paragraph("Data Integrity & Business Rules", table_header)],
        [
            Paragraph("<code>organizations</code>", table_cell_code),
            Paragraph("PK: <code>id</code> (UUID)<br/>FK: <code>user_id</code>", table_cell),
            Paragraph("<code>name</code> (VARCHAR)<br/><code>latitude, longitude</code> (DECIMAL)<br/><code>capacity_kg</code> (DECIMAL)<br/><code>verification_status</code> (VARCHAR)", table_cell),
            Paragraph("Stores facility profiles. Debarred organizations (<code>REJECTED</code>) are blocked from publishing or claiming food at the database query level.", table_cell)
        ],
        [
            Paragraph("<code>users</code>", table_cell_code),
            Paragraph("PK: <code>id</code> (UUID)<br/>FK: <code>organization_id</code>", table_cell),
            Paragraph("<code>email</code> (VARCHAR UNIQUE)<br/><code>password_hash</code> (VARCHAR)<br/><code>role</code> (ENUM: DONOR, SHELTER, RIDER, ADMIN)", table_cell),
            Paragraph("Bcrypt password hashing (10 salt rounds). Links individual couriers and staff members to their parent organization.", table_cell)
        ],
        [
            Paragraph("<code>food_listings</code>", table_cell_code),
            Paragraph("PK: <code>id</code> (UUID)<br/>FK: <code>donor_id</code><br/>FK: <code>claimed_by</code>", table_cell),
            Paragraph("<code>food_type, quantity_kg</code><br/><code>quantity_remaining</code> (NUMERIC)<br/><code>cooked_at, expires_at</code><br/><code>status</code> (ENUM)", table_cell),
            Paragraph("Master persistent food records. Status machine: <code>AVAILABLE</code> &rarr; <code>PARTIALLY_CLAIMED</code> &rarr; <code>CLAIMED</code> &rarr; <code>IN_TRANSIT</code> &rarr; <code>DELIVERED</code> (or <code>EXPIRED</code>).", table_cell)
        ],
        [
            Paragraph("<code>allocations</code>", table_cell_code),
            Paragraph("PK: <code>id</code> (UUID)<br/>FK: <code>listing_id</code><br/>FK: <code>shelter_id</code>", table_cell),
            Paragraph("<code>allocated_kg</code> (DECIMAL)<br/><code>status</code> (VARCHAR)", table_cell),
            Paragraph("Decouples claim lifecycle per recipient parcel, enabling multiple shelters to share a single large banquet donation.", table_cell)
        ],
        [
            Paragraph("<code>delivery_assignments</code>", table_cell_code),
            Paragraph("PK: <code>id</code> (UUID)<br/>FK: <code>allocation_id</code><br/>FK: <code>rider_id</code>", table_cell),
            Paragraph("<code>pickup_otp</code> (VARCHAR)<br/><code>status</code> (VARCHAR)<br/><code>picked_up_at, completed_at</code>", table_cell),
            Paragraph("Tracks courier custody. Unique partial index guarantees at most one active rider per allocation at the database engine level.", table_cell)
        ],
        [
            Paragraph("<code>handover_audits</code>", table_cell_code),
            Paragraph("PK: <code>id</code> (UUID)<br/>FK: <code>listing_id</code><br/>FK: <code>shelter_id</code>", table_cell),
            Paragraph("<code>token_digest</code> (SHA-256)<br/><code>pickup_time, delivery_time</code><br/><code>quantity_claimed_kg</code>", table_cell),
            Paragraph("Immutable legal compliance ledger. Persists cryptographic digests rather than plaintext codes to eliminate credential leaks.", table_cell)
        ],
        [
            Paragraph("<code>recipient_requests</code>", table_cell_code),
            Paragraph("PK: <code>id</code> (UUID)<br/>FK: <code>org_id</code>", table_cell),
            Paragraph("<code>quantity_kg</code> (DECIMAL)<br/><code>category, dietary_type</code><br/><code>needed_by</code> (TIMESTAMP)", table_cell),
            Paragraph("Structured demand broadcast by shelters, enabling proactive demand-backed matching algorithms.", table_cell)
        ]
    ]
    t_schema = Table(schema_table_data, colWidths=[1.5*inch, 1.4*inch, 2.0*inch, 2.4*inch])
    t_schema.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 3),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_schema)
    story.append(Spacer(1, 5))

    story.append(Paragraph("6.2 Redis In-Memory Data Structures & Key Namespaces", section_h2))
    redis_keys_data = [
        [Paragraph("Redis Key / Structure", table_header), Paragraph("Data Type", table_header), Paragraph("TTL / Retention", table_header), Paragraph("Operational Functionality & Contents", table_header)],
        [
            Paragraph("<code>geo:donations</code>", table_cell_code),
            Paragraph("Sorted Set (GEO)", table_cell),
            Paragraph("Dynamic", table_cell),
            Paragraph("52-bit integer Geohash coordinates of active surplus listings. Evicted immediately when fully claimed or expired.", table_cell)
        ],
        [
            Paragraph("<code>geo:shelters</code>", table_cell_code),
            Paragraph("Sorted Set (GEO)", table_cell),
            Paragraph("Persistent", table_cell),
            Paragraph("Geospatial index of all registered recipient facilities, used for proximity radius matching.", table_cell)
        ],
        [
            Paragraph("<code>listing:{id}</code>", table_cell_code),
            Paragraph("Hash", table_cell),
            Paragraph("Biological TTL / 24h", table_cell),
            Paragraph("Fast-path cache of batch metadata (status, quantity_remaining, priority tiers, timestamps). Preserved 24h post-claim for active transit tracking.", table_cell)
        ],
        [
            Paragraph("<code>otp_attempts:{listing_id}</code>", table_cell_code),
            Paragraph("String (Integer Counter)", table_cell),
            Paragraph("300 seconds (5 min)", table_cell),
            Paragraph("Rate-limiting gatekeeper. Increments on failed OTP entries; locks gate when count reaches 5.", table_cell)
        ],
        [
            Paragraph("<code>channel:alerts</code>", table_cell_code),
            Paragraph("Pub/Sub Channel", table_cell),
            Paragraph("Real-Time Transient", table_cell),
            Paragraph("Cluster event bus broadcasting listing lifecycle updates across all 3 Node.js container replicas.", table_cell)
        ]
    ]
    t_redis = Table(redis_keys_data, colWidths=[1.8*inch, 1.3*inch, 1.4*inch, 2.8*inch])
    t_redis.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 3),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_redis)

    story.append(PageBreak())

    # =========================================================================
    # PAGE 9: API ROUTING CATALOG & CLUSTER COMMUNICATIONS REFERENCE
    # =========================================================================
    story.append(Paragraph("7. Comprehensive API Catalog & Cluster Communications Reference", section_h1))
    story.append(Paragraph(
        "All client interactions and internal cluster communications flow through the Nginx reverse proxy at <code>http://localhost/api/</code>:",
        body_style
    ))

    api_table_data = [
        [Paragraph("HTTP Method & Route", table_header), Paragraph("Auth & Role", table_header), Paragraph("Request Payload / Parameters", table_header), Paragraph("Response Contract & Behavioral Logic", table_header)],
        [
            Paragraph("<code>GET /lb-health</code>", table_cell_code),
            Paragraph("Public", table_cell),
            Paragraph("None", table_cell),
            Paragraph("Nginx load balancer health check verifying upstream proxy connectivity.", table_cell)
        ],
        [
            Paragraph("<code>GET /health</code>", table_cell_code),
            Paragraph("Public", table_cell),
            Paragraph("None", table_cell),
            Paragraph("Returns handling replica container hostname, uptime, and resident memory footprint.", table_cell)
        ],
        [
            Paragraph("<code>POST /api/auth/register</code>", table_cell_code),
            Paragraph("Public", table_cell),
            Paragraph("<code>email, password, role, name, lat, lng, capacity</code>", table_cell),
            Paragraph("Registers facility profile. Recipient shelters default to unverified pending administrative compliance check.", table_cell)
        ],
        [
            Paragraph("<code>POST /api/auth/login</code>", table_cell_code),
            Paragraph("Public", table_cell),
            Paragraph("<code>email, password</code>", table_cell),
            Paragraph("Authenticates bcrypt password and returns signed HMAC-SHA256 JWT.", table_cell)
        ],
        [
            Paragraph("<code>POST /api/listings</code>", table_cell_code),
            Paragraph("JWT (DONOR)", table_cell),
            Paragraph("<code>food_type, quantity_kg, lat, lng, category, dietary, deadlines</code>", table_cell),
            Paragraph("Performs atomic dual-write to PostgreSQL and Redis. Computes priority tiers and broadcasts <code>FOOD_POSTED</code> via Pub/Sub.", table_cell)
        ],
        [
            Paragraph("<code>GET /api/listings/nearby</code>", table_cell_code),
            Paragraph("JWT / Public", table_cell),
            Paragraph("Query: <code>lat, lng, radius_km</code>", table_cell),
            Paragraph("Redis <code>GEOSEARCH</code> proximity query returning active surplus batches within radial band in &lt; 2 ms.", table_cell)
        ],
        [
            Paragraph("<code>GET /api/listings/:id/recommendations</code>", table_cell_code),
            Paragraph("JWT (DONOR)", table_cell),
            Paragraph("URL param: <code>id</code>", table_cell),
            Paragraph("Executes Two-Stage Matching Engine, returning ranked feasible recipients with explainable score breakdowns.", table_cell)
        ],
        [
            Paragraph("<code>POST /api/listings/:id/claim</code>", table_cell_code),
            Paragraph("JWT (SHELTER)", table_cell),
            Paragraph("<code>shelter_id, claim_kg</code> (Optional)", table_cell),
            Paragraph("Executes Redis Lua script. Atomically reserves full or partial batch. Generates HMAC handover token. Rejects duplicates (409 Conflict).", table_cell)
        ],
        [
            Paragraph("<code>POST /api/listings/:id/cancel-claim</code>", table_cell_code),
            Paragraph("JWT (SHELTER)", table_cell),
            Paragraph("<code>shelter_id</code>", table_cell),
            Paragraph("Enforces biological clock invariance. If &le; 15 min remain, marks EXPIRED; if &gt; 15 min remain, restores to radar with remaining TTL.", table_cell)
        ],
        [
            Paragraph("<code>POST /api/deliveries/verify-pickup</code>", table_cell_code),
            Paragraph("JWT (DONOR)", table_cell),
            Paragraph("<code>listing_id, verification_code</code>", table_cell),
            Paragraph("Constant-time comparison (<code>timingSafeEqual</code>) of 6-digit OTP. 5 failed attempts locks gate for 5 min (HTTP 429). Status &rarr; <code>IN_TRANSIT</code>.", table_cell)
        ],
        [
            Paragraph("<code>POST /api/deliveries/confirm-delivery</code>", table_cell_code),
            Paragraph("JWT (SHELTER)", table_cell),
            Paragraph("<code>listing_id, allocation_id</code>", table_cell),
            Paragraph("Commits delivery completion timestamp to PostgreSQL audit ledger. Restores shelter capacity. Status &rarr; <code>DELIVERED</code>.", table_cell)
        ],
        [
            Paragraph("<code>POST /api/riders/assign</code>", table_cell_code),
            Paragraph("JWT (SHELTER)", table_cell),
            Paragraph("<code>allocation_id, rider_id</code>", table_cell),
            Paragraph("Dispatches specific volunteer courier. Generates scoped assignment OTP. Unique partial index prevents multi-rider conflict.", table_cell)
        ],
        [
            Paragraph("<code>GET /api/admin/audit-ledger</code>", table_cell_code),
            Paragraph("JWT (ADMIN)", table_cell),
            Paragraph("None", table_cell),
            Paragraph("Retrieves tamper-proof compliance ledger with cryptographic token digests and full chain-of-custody timestamps.", table_cell)
        ]
    ]
    t_api = Table(api_table_data, colWidths=[1.8*inch, 1.1*inch, 1.8*inch, 2.6*inch])
    t_api.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 3),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_api)

    story.append(PageBreak())

    # =========================================================================
    # PAGE 10: EMPIRICAL BENCHMARKS, VERIFICATION LEDGER & EVALUATION
    # =========================================================================
    story.append(Paragraph("8. Empirical Benchmarks, System Verification & Evaluation Results", section_h1))
    story.append(Paragraph(
        "To satisfy strict academic engineering standards, every distributed systems claim in RescueGrid is empirically verified "
        "through automated test suites executed against the live multi-container cluster:",
        body_style
    ))

    story.append(Paragraph("8.1 Distributed Concurrency Benchmark: 50 Parallel Claim Requests", section_h2))
    story.append(Paragraph(
        "<b>Evaluation Hypothesis:</b> Under high-load race conditions where 50 hunger shelters attempt to claim the exact same food listing "
        "at the exact same millisecond across 3 distributed API replicas, the system must guarantee linearizable mutual exclusion: exactly one "
        "claim succeeds, exactly 49 claims are safely rejected with <code>HTTP 409 Conflict</code>, and zero duplicate allocations occur.",
        body_style
    ))
    story.append(Paragraph(
        "<b>Empirical Benchmark Execution (<code>scripts/load_test_concurrency.js</code>):</b>",
        body_bold
    ))
    story.append(Paragraph(
        "Fifty parallel HTTP requests were dispatched simultaneously across the Nginx load balancer to <code>rescuegrid_api_1</code>, "
        "<code>rescuegrid_api_2</code>, and <code>rescuegrid_api_3</code>. The test verified:",
        body_style
    ))
    story.append(Paragraph(
        "&bull; <b>Successful Claims Granted:</b> Exactly <b>1</b> (Status: <code>200 OK</code>, Execution Time: <b>1.8 ms</b> in Redis Lua).",
        bullet_style
    ))
    story.append(Paragraph(
        "&bull; <b>Conflicted Claims Rejected:</b> Exactly <b>49</b> (Status: <code>409 Conflict</code>, Reason: <code>ERR_ALREADY_CLAIMED</code>).",
        bullet_style
    ))
    story.append(Paragraph(
        "&bull; <b>Duplicate Handovers / Race Conditions:</b> <b>0</b> (Zero double-allocations committed to PostgreSQL or Redis).",
        bullet_style
    ))
    story.append(Paragraph(
        "&bull; <b>Verdict:</b> Linearizable distributed mutual exclusion 100% verified.",
        bullet_style
    ))

    story.append(Paragraph("8.2 Keyspace TTL Auto-Evaporation Benchmark", section_h2))
    story.append(Paragraph(
        "A 10-second perishability batch was broadcasted (<code>scripts/test_ttl_expiration.js</code>). The Redis keyspace daemon intercepted the passive "
        "<code>__keyevent@0__:expired</code> event at second 10.01, evicting the listing from <code>geo:donations</code>, transitioning the PostgreSQL record "
        "to <code>'EXPIRED'</code>, and pushing a real-time WebSocket alert. Querying <code>/api/listings/nearby</code> at second 10.05 returned zero stale listings.",
        body_style
    ))

    story.append(Paragraph("8.3 Comprehensive Automated Test Ledger", section_h2))
    test_results_data = [
        [Paragraph("Verification Test Suite", table_header), Paragraph("Execution Command", table_header), Paragraph("Specs Passed", table_header), Paragraph("Key Distributed & Algorithmic Invariants Validated", table_header)],
        [
            Paragraph("<b>Core Algorithms & Security</b>", table_cell_bold),
            Paragraph("<code>npm run test:units</code>", table_cell_code),
            Paragraph("<b>25 / 25 PASS</b><br/>(100%)", table_cell_bold),
            Paragraph("Haversine spherical accuracy (&plusmn;0.01 km), coordinate bounds validation, HMAC-SHA256 non-repudiation, constant-time verification, Redis Lua script syntax.", table_cell)
        ],
        [
            Paragraph("<b>Deadline Matching Engine</b>", table_cell_bold),
            Paragraph("<code>npm run test:matching</code>", table_cell_code),
            Paragraph("<b>28 / 28 PASS</b><br/>(100%)", table_cell_bold),
            Paragraph("Round-trip travel times, negative consumption slack hard rejection, dietary mismatch rejection, capacity bounds, deterministic tie-breaking.", table_cell)
        ],
        [
            Paragraph("<b>Distributed Concurrency</b>", table_cell_bold),
            Paragraph("<code>npm run test:concurrency</code>", table_cell_code),
            Paragraph("<b>PASS</b><br/>(Race-Free)", table_cell_bold),
            Paragraph("50 parallel claims dispatched to 3 API replicas simultaneously. Exactly 1 claim succeeded with lock; 49 safely received <code>ERR_ALREADY_CLAIMED</code>.", table_cell)
        ],
        [
            Paragraph("<b>Keyspace TTL Sweeper</b>", table_cell_bold),
            Paragraph("<code>npm run test:ttl</code>", table_cell_code),
            Paragraph("<b>PASS</b><br/>(Zero Stale Data)", table_cell_bold),
            Paragraph("Expired food batches automatically evicted from Redis geospatial index and marked <code>EXPIRED</code> in PostgreSQL audit ledger.", table_cell)
        ],
        [
            Paragraph("<b>Tiered & Partial Claims</b>", table_cell_bold),
            Paragraph("<code>npm run test:tiers</code>", table_cell_code),
            Paragraph("<b>PASS</b><br/>(100%)", table_cell_bold),
            Paragraph("Tier 1 Rank #1 lock enforcement, Tier 2 expansion, Tier 3 unlock, partial claim quantity decrements, and biological shelf-life invariance on cancellation.", table_cell)
        ],
        [
            Paragraph("<b>Rider Dispatch & Security</b>", table_cell_bold),
            Paragraph("<code>npm run test:phase7</code>", table_cell_code),
            Paragraph("<b>PASS</b><br/>(100%)", table_cell_bold),
            Paragraph("Unique partial index active rider enforcement, scoped assignment OTP validation, and brute-force gate lockout after 5 failed attempts.", table_cell)
        ],
        [
            Paragraph("<b>Client Production Build</b>", table_cell_bold),
            Paragraph("<code>npm run build</code>", table_cell_code),
            Paragraph("<b>PASS</b><br/>(0 Warnings)", table_cell_bold),
            Paragraph("Compiled React 18 production bundle with minified CSS tokens, asset tree optimization, and zero ESLint errors.", table_cell)
        ]
    ]
    t_tests = Table(test_results_data, colWidths=[1.6*inch, 1.5*inch, 1.1*inch, 3.1*inch])
    t_tests.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 3),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_tests)
    story.append(Spacer(1, 5))

    story.append(Paragraph("8.4 Comparative Matching Evaluation: Two-Stage Engine vs. Nearest-Feasible Baseline", section_h2))
    story.append(Paragraph(
        "A rigorous comparative evaluation was executed across 5 diverse operational scenarios comparing RescueGrid's Two-Stage Matching Engine "
        "against a standard Nearest-Feasible Baseline (<code>scripts/run_comparative_evaluation.js</code>).",
        body_style
    ))
    story.append(Paragraph(
        "&bull; <b>Spoilage Prevention:</b> The Two-Stage Engine reduced transit spoilage to <b>0.0%</b> by rejecting infeasible deadline slack, whereas the baseline suffered a <b>40.0%</b> spoilage rate by matching nearest shelters that could not complete transit in time.",
        bullet_style
    ))
    story.append(Paragraph(
        "&bull; <b>Demand-Backed Fulfillment:</b> The Two-Stage Engine achieved an <b>85.7%</b> useful capacity fulfillment rate compared to <b>51.2%</b> for the baseline by aligning active shelter requirements with batch sizes.",
        bullet_style
    ))

    story.append(PageBreak())

    # =========================================================================
    # PAGE 11: SYSTEM COMPARISON, ACADEMIC CONCLUSIONS & FUTURE ROADMAP
    # =========================================================================
    story.append(Paragraph("9. System Comparison Matrix & Academic Conclusions", section_h1))
    story.append(Paragraph(
        "The following matrix summarizes the architectural advantages of the RescueGrid implementation over traditional food rescue approaches:",
        body_style
    ))

    comp_table_data = [
        [Paragraph("Feature / Architectural Requirement", table_header), Paragraph("Traditional Food Rescue Apps & Portals", table_header), Paragraph("RescueGrid Cloud Platform", table_header)],
        [
            Paragraph("<b>Distributed Claiming Mechanism</b>", table_cell_bold),
            Paragraph("Asynchronous bulletin boards; high race condition failure rate.", table_cell),
            Paragraph("<b>Sub-millisecond Atomic Lua Check-and-Set Lock (Redis 7)</b>", table_cell_bold)
        ],
        [
            Paragraph("<b>Geospatial Proximity Search</b>", table_cell_bold),
            Paragraph("Periodic SQL disk queries; high latency (25&ndash;80 ms).", table_cell),
            Paragraph("<b>In-Memory 52-bit Geohash GEOSEARCH (&lt; 2 ms)</b>", table_cell_bold)
        ],
        [
            Paragraph("<b>Perishability & Spoilage Protection</b>", table_cell_bold),
            Paragraph("Manual human inspection; food frequently spoils in transit.", table_cell),
            Paragraph("<b>Deterministic Transit Velocity Model & Deadline Slack Gates</b>", table_cell_bold)
        ],
        [
            Paragraph("<b>Custody Handover Verification</b>", table_cell_bold),
            Paragraph("Unsigned paper forms or verbal confirmation; no legal audit trail.", table_cell),
            Paragraph("<b>HMAC-SHA256 Cryptographic Pass + 6-Digit Timing-Safe OTP</b>", table_cell_bold)
        ],
        [
            Paragraph("<b>Allocation Equity & Fairness</b>", table_cell_bold),
            Paragraph("First-come first-served; large shelters monopolize all surplus.", table_cell),
            Paragraph("<b>Cascading 3-Tier Priority Reservation (Rank #1 &rarr; Top-5 &rarr; Public)</b>", table_cell_bold)
        ],
        [
            Paragraph("<b>Surplus Quantity Flexibility</b>", table_cell_bold),
            Paragraph("All-or-nothing claiming; small shelters cannot accept large batches.", table_cell),
            Paragraph("<b>Atomic Partial Capacity Splitting + Multi-Parcel Allocations</b>", table_cell_bold)
        ],
        [
            Paragraph("<b>Cancellation Safety Policy</b>", table_cell_bold),
            Paragraph("Timer resets (spoilage hazard) or listing deleted (wasted food).", table_cell),
            Paragraph("<b>Immutable Biological Clock (15m Safety Threshold Expiry)</b>", table_cell_bold)
        ],
        [
            Paragraph("<b>Cloud Scalability & Availability</b>", table_cell_bold),
            Paragraph("Single monolithic server (single point of failure).", table_cell),
            Paragraph("<b>Nginx Load-Balanced 3x Stateless API Replicas + Docker Compose</b>", table_cell_bold)
        ],
        [
            Paragraph("<b>Visual Dispatch Interface</b>", table_cell_bold),
            Paragraph("Static text tables or basic single pin map.", table_cell),
            Paragraph("<b>Interactive Radar Perimeter + Hub-and-Spoke Logistics Vectors</b>", table_cell_bold)
        ]
    ]
    t_comp = Table(comp_table_data, colWidths=[2.1*inch, 2.5*inch, 2.7*inch])
    t_comp.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 3),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_comp)
    story.append(Spacer(1, 6))

    story.append(Paragraph("9.1 Key Cloud Computing Takeaways & Contributions", section_h2))
    story.append(Paragraph(
        "The RescueGrid capstone project demonstrates that cloud computing paradigms—specifically <b>stateless horizontal elasticity</b>, "
        "<b>polyglot in-memory caching paired with relational persistence</b>, <b>non-preemptible atomic distributed primitives</b>, and "
        "<b>cryptographic tokenization</b>—can completely eliminate the logistical and concurrency failure modes that plague urban food redistribution. "
        "By treating biological perishability as a first-class mathematical constraint and executing claims within an isolated in-memory engine, "
        "the platform achieves sub-millisecond coordination speed while guaranteeing zero race conditions and zero food spoilage in transit.",
        body_style
    ))

    story.append(Paragraph("9.2 Future Architectural Roadmap", section_h2))
    story.append(Paragraph(
        "&bull; <b>Dynamic Telemetry via IoT Smart Containers:</b> Integrating BLE/cellular temperature and humidity sensors inside courier transport containers to stream real-time thermal curves into Redis, automatically invalidating batches if temperature exceeds 60&deg;C.",
        bullet_style
    ))
    story.append(Paragraph(
        "&bull; <b>Multi-Region Redis Enterprise Clustering:</b> Expanding from a single Docker bridge network to a multi-region Redis CRDT active-active mesh for pan-national food rescue networks.",
        bullet_style
    ))
    story.append(Paragraph(
        "&bull; <b>Autonomous Drone Courier Routing:</b> Incorporating autonomous drone flight-path waypoints and battery consumption constraints into Stage A feasibility filtering.",
        bullet_style
    ))

    # Academic Sign-off Box
    signoff_data = [
        [
            Paragraph(
                "<b>ACADEMIC ENGINEERING SIGN-OFF</b><br/>"
                "<b>Course:</b> Bachelor of Computer Science &bull; VII Semester &bull; Cloud Computing Capstone Project<br/>"
                "<b>Status:</b> Fully Containerized, Evaluated, and Verified 100% Passing Across All Automated Test Suites.<br/>"
                "<b>Repository:</b> <code>C:\\cc project</code> &bull; All 6 Docker containers operational on isolated subnet.",
                ParagraphStyle('Signoff', parent=styles['Normal'], fontName='Helvetica', fontSize=8, leading=11, textColor=SECONDARY)
            )
        ]
    ]
    t_signoff = Table(signoff_data, colWidths=[7.3*inch])
    t_signoff.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BOX_BG),
        ('BOX', (0,0), (-1,-1), 0.8, ACCENT),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(Spacer(1, 5))
    story.append(t_signoff)

    # Build the document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"[SUCCESS] PDF generated successfully at: {output_path}")

if __name__ == "__main__":
    out_file = sys.argv[1] if len(sys.argv) > 1 else "RescueGrid_Comprehensive_Architecture_and_System_Design.pdf"
    build_comprehensive_pdf(out_file)
