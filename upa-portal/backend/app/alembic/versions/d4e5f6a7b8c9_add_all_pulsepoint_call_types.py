"""Add all PulsePoint call type codes to call_type_config

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-02-28 12:00:00.000000

"""
import uuid

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None

# New call types to add (codes not already seeded in previous migrations).
# Fire-related types default to enabled; others default to disabled.
NEW_CALL_TYPES = [
    # ── Fire Types ──
    {"code": "RF",   "description": "Residential Fire",          "is_enabled": True,  "sort_order": 20},
    {"code": "WSF",  "description": "Confirmed Structure Fire",  "is_enabled": True,  "sort_order": 21},
    {"code": "WCF",  "description": "Working Commercial Fire",   "is_enabled": True,  "sort_order": 22},
    {"code": "WRF",  "description": "Working Residential Fire",  "is_enabled": True,  "sort_order": 23},
    {"code": "VEG",  "description": "Vegetation Fire",           "is_enabled": True,  "sort_order": 24},
    {"code": "WVEG", "description": "Confirmed Vegetation Fire", "is_enabled": True,  "sort_order": 25},
    {"code": "AF",   "description": "Appliance Fire",            "is_enabled": True,  "sort_order": 26},
    {"code": "CHIM", "description": "Chimney Fire",              "is_enabled": True,  "sort_order": 27},
    {"code": "ELF",  "description": "Electrical Fire",           "is_enabled": True,  "sort_order": 28},
    {"code": "MF",   "description": "Marine Fire",               "is_enabled": True,  "sort_order": 29},
    {"code": "OF",   "description": "Outside Fire",              "is_enabled": True,  "sort_order": 30},
    {"code": "PF",   "description": "Pole Fire",                 "is_enabled": True,  "sort_order": 31},
    {"code": "TF",   "description": "Tank Fire",                 "is_enabled": True,  "sort_order": 32},
    {"code": "CB",   "description": "Controlled Burn",           "is_enabled": False, "sort_order": 33},
    {"code": "EF",   "description": "Extinguished Fire",         "is_enabled": False, "sort_order": 34},
    {"code": "FIRE", "description": "Fire",                      "is_enabled": True,  "sort_order": 35},
    {"code": "FULL", "description": "Full Assignment",           "is_enabled": True,  "sort_order": 36},
    {"code": "IF",   "description": "Illegal Fire",              "is_enabled": False, "sort_order": 37},
    # ── Alarms ──
    {"code": "AED",  "description": "AED Alarm",                 "is_enabled": False, "sort_order": 40},
    {"code": "MA",   "description": "Manual Alarm",              "is_enabled": False, "sort_order": 41},
    {"code": "SD",   "description": "Smoke Detector",            "is_enabled": False, "sort_order": 42},
    {"code": "TRBL", "description": "Trouble Alarm",             "is_enabled": False, "sort_order": 43},
    {"code": "WFA",  "description": "Waterflow Alarm",           "is_enabled": False, "sort_order": 44},
    {"code": "CMA",  "description": "Carbon Monoxide Alarm",     "is_enabled": False, "sort_order": 45},
    # ── Medical ──
    {"code": "CPR",  "description": "CPR Needed",                "is_enabled": False, "sort_order": 50},
    {"code": "IFT",  "description": "Interfacility Transfer",    "is_enabled": False, "sort_order": 51},
    {"code": "MCI",  "description": "Multi Casualty",            "is_enabled": False, "sort_order": 52},
    {"code": "CP",   "description": "Community Paramedicine",    "is_enabled": False, "sort_order": 53},
    # ── Traffic ──
    {"code": "TCE",  "description": "Expanded Traffic Collision", "is_enabled": False, "sort_order": 60},
    {"code": "TCP",  "description": "Collision w/ Pedestrian",    "is_enabled": False, "sort_order": 61},
    {"code": "TCS",  "description": "Collision w/ Structure",     "is_enabled": False, "sort_order": 62},
    {"code": "TCT",  "description": "Collision w/ Train",         "is_enabled": False, "sort_order": 63},
    {"code": "RTE",  "description": "Railroad/Train Emergency",   "is_enabled": False, "sort_order": 64},
    # ── Hazmat / Utilities ──
    {"code": "HMR",  "description": "Hazmat Response",           "is_enabled": False, "sort_order": 70},
    {"code": "HMI",  "description": "Hazmat Investigation",      "is_enabled": False, "sort_order": 71},
    {"code": "GAS",  "description": "Gas Leak",                  "is_enabled": False, "sort_order": 72},
    {"code": "HC",   "description": "Hazardous Condition",       "is_enabled": False, "sort_order": 73},
    {"code": "EE",   "description": "Electrical Emergency",      "is_enabled": False, "sort_order": 74},
    {"code": "PLE",  "description": "Powerline Emergency",       "is_enabled": False, "sort_order": 75},
    {"code": "WA",   "description": "Wires Arcing",              "is_enabled": False, "sort_order": 76},
    {"code": "WD",   "description": "Wires Down",                "is_enabled": False, "sort_order": 77},
    {"code": "WDA",  "description": "Wires Down/Arcing",         "is_enabled": False, "sort_order": 78},
    {"code": "PE",   "description": "Pipeline Emergency",        "is_enabled": False, "sort_order": 79},
    {"code": "EX",   "description": "Explosion",                 "is_enabled": False, "sort_order": 80},
    {"code": "TE",   "description": "Transformer Explosion",     "is_enabled": False, "sort_order": 81},
    {"code": "SH",   "description": "Sheared Hydrant",           "is_enabled": False, "sort_order": 82},
    # ── Rescue ──
    {"code": "RES",  "description": "Rescue",                    "is_enabled": False, "sort_order": 90},
    {"code": "AR",   "description": "Animal Rescue",             "is_enabled": False, "sort_order": 91},
    {"code": "CR",   "description": "Cliff Rescue",              "is_enabled": False, "sort_order": 92},
    {"code": "CSR",  "description": "Confined Space Rescue",     "is_enabled": False, "sort_order": 93},
    {"code": "ELR",  "description": "Elevator Rescue",           "is_enabled": False, "sort_order": 94},
    {"code": "EER",  "description": "Elevator/Escalator Rescue", "is_enabled": False, "sort_order": 95},
    {"code": "IR",   "description": "Ice Rescue",                "is_enabled": False, "sort_order": 96},
    {"code": "RR",   "description": "Rope Rescue",               "is_enabled": False, "sort_order": 97},
    {"code": "TR",   "description": "Technical Rescue",          "is_enabled": False, "sort_order": 98},
    {"code": "TNR",  "description": "Trench Rescue",             "is_enabled": False, "sort_order": 99},
    {"code": "USAR", "description": "Urban Search and Rescue",   "is_enabled": False, "sort_order": 100},
    {"code": "WR",   "description": "Water Rescue",              "is_enabled": False, "sort_order": 101},
    {"code": "SC",   "description": "Structural Collapse",       "is_enabled": False, "sort_order": 102},
    {"code": "VS",   "description": "Vessel Sinking",            "is_enabled": False, "sort_order": 103},
    {"code": "IA",   "description": "Industrial Accident",       "is_enabled": False, "sort_order": 104},
    # ── Investigation ──
    {"code": "AI",   "description": "Arson Investigation",       "is_enabled": False, "sort_order": 110},
    {"code": "FWI",  "description": "Fireworks Investigation",   "is_enabled": False, "sort_order": 111},
    {"code": "INV",  "description": "Investigation",             "is_enabled": False, "sort_order": 112},
    {"code": "OI",   "description": "Odor Investigation",        "is_enabled": False, "sort_order": 113},
    {"code": "SI",   "description": "Smoke Investigation",       "is_enabled": False, "sort_order": 114},
    # ── Service / Public Assist ──
    {"code": "PS",   "description": "Public Service",            "is_enabled": False, "sort_order": 120},
    {"code": "LA",   "description": "Lift Assist",               "is_enabled": False, "sort_order": 121},
    {"code": "PA",   "description": "Police Assist",             "is_enabled": False, "sort_order": 122},
    {"code": "FL",   "description": "Flooding",                  "is_enabled": False, "sort_order": 123},
    {"code": "LR",   "description": "Ladder Request",            "is_enabled": False, "sort_order": 124},
    {"code": "BT",   "description": "Bomb Threat",               "is_enabled": False, "sort_order": 125},
    {"code": "EM",   "description": "Emergency",                 "is_enabled": False, "sort_order": 126},
    {"code": "ER",   "description": "Emergency Response",        "is_enabled": False, "sort_order": 127},
    {"code": "TD",   "description": "Tree Down",                 "is_enabled": False, "sort_order": 128},
    {"code": "WE",   "description": "Water Emergency",           "is_enabled": False, "sort_order": 129},
    # ── Lockout ──
    {"code": "CL",   "description": "Commercial Lockout",        "is_enabled": False, "sort_order": 130},
    {"code": "LO",   "description": "Lockout",                   "is_enabled": False, "sort_order": 131},
    {"code": "RL",   "description": "Residential Lockout",       "is_enabled": False, "sort_order": 132},
    {"code": "VL",   "description": "Vehicle Lockout",           "is_enabled": False, "sort_order": 133},
    # ── Aircraft ──
    {"code": "AC",   "description": "Aircraft Crash",            "is_enabled": False, "sort_order": 140},
    {"code": "AE",   "description": "Aircraft Emergency",        "is_enabled": False, "sort_order": 141},
    {"code": "AES",  "description": "Aircraft Emergency Standby","is_enabled": False, "sort_order": 142},
    {"code": "LZ",   "description": "Landing Zone",              "is_enabled": False, "sort_order": 143},
    # ── Mutual Aid ──
    {"code": "AA",   "description": "Auto Aid",                  "is_enabled": False, "sort_order": 150},
    {"code": "MU",   "description": "Mutual Aid",                "is_enabled": False, "sort_order": 151},
    {"code": "ST",   "description": "Strike Team/Task Force",    "is_enabled": False, "sort_order": 152},
    # ── Weather / Natural Disaster ──
    {"code": "EQ",   "description": "Earthquake",                "is_enabled": False, "sort_order": 160},
    {"code": "FLW",  "description": "Flood Warning",             "is_enabled": False, "sort_order": 161},
    {"code": "TOW",  "description": "Tornado Warning",           "is_enabled": False, "sort_order": 162},
    {"code": "TSW",  "description": "Tsunami Warning",           "is_enabled": False, "sort_order": 163},
    {"code": "WX",   "description": "Weather Incident",          "is_enabled": False, "sort_order": 164},
    # ── Administrative ──
    {"code": "BP",   "description": "Burn Permit",               "is_enabled": False, "sort_order": 170},
    {"code": "CA",   "description": "Community Activity",        "is_enabled": False, "sort_order": 171},
    {"code": "FW",   "description": "Fire Watch",                "is_enabled": False, "sort_order": 172},
    {"code": "MC",   "description": "Move-up/Cover",             "is_enabled": False, "sort_order": 173},
    {"code": "NO",   "description": "Notification",              "is_enabled": False, "sort_order": 174},
    {"code": "STBY", "description": "Standby",                   "is_enabled": False, "sort_order": 175},
    {"code": "TEST", "description": "Test",                      "is_enabled": False, "sort_order": 176},
    {"code": "TRNG", "description": "Training",                  "is_enabled": False, "sort_order": 177},
]


def upgrade() -> None:
    # Use raw SQL with ON CONFLICT to safely skip codes that already exist
    conn = op.get_bind()
    for ct in NEW_CALL_TYPES:
        conn.execute(
            sa.text(
                """
                INSERT INTO call_type_config (id, code, description, is_enabled, sort_order, created_at)
                VALUES (:id, :code, :description, :is_enabled, :sort_order, now())
                ON CONFLICT (code) DO NOTHING
                """
            ),
            {
                "id": str(uuid.uuid4()),
                "code": ct["code"],
                "description": ct["description"],
                "is_enabled": ct["is_enabled"],
                "sort_order": ct["sort_order"],
            },
        )


def downgrade() -> None:
    codes = [ct["code"] for ct in NEW_CALL_TYPES]
    op.get_bind().execute(
        sa.text("DELETE FROM call_type_config WHERE code = ANY(:codes)"),
        {"codes": codes},
    )
