import type { StackSpec } from "../../spec";

const B = "booking_system_backend";

/**
 * Flagship sample: an agent-written feature on IBM's Galaxium Travels demo app,
 * split into five layers. Round 0 failed at Layer 02 because a required response
 * field arrived before the code that fills it; Bob moved one atom and round 1 passed.
 */
export const galaxiumTravels184: StackSpec = {
  id: "galaxium-travels-184",
  repoId: "galaxium-travels",
  prNumber: 184,
  title: "Add cancellations & refunds",
  branch: "feature/cancellations",
  base: "main",
  status: "verified",
  visibility: "public",
  command: "pytest -q",
  headTree: "9c1e47d2a8f1b3c5d7e9f0a1b2c3d4e5f6a7b8c9",
  runStartedMinutesAgo: 124,
  prStart: 191,
  bob: {
    surface: "Bob IDE",
    mode: "✂ Cleave",
    bobcoins: 1.84,
    tokens: 214380,
    toolCalls: 46,
    mcpCalls: 14,
    subagents: 4,
    durationSec: 372,
    hookAllowed: 46,
    hookBlocked: 0,
  },
  layers: [
    {
      name: "Data model",
      rationale:
        "Everything else reads these types. Booking gains a status and cancellation fields, refunds get their own table, and the API schemas learn the new shapes. Nothing here changes behaviour on its own.",
      tests: 44,
      durationMs: 3100,
      atoms: [
        {
          key: "m-enum",
          file: `${B}/models.py`,
          summary: "Add BookingStatus enum",
          add: 9,
          patch: `@@ -9,0 +10,9 @@ from database import Base
+
+
+class BookingStatus(str, enum.Enum):
+    """Lifecycle of a booking."""
+
+    CONFIRMED = "confirmed"
+    CANCELLED = "cancelled"
+    REFUNDED = "refunded"
+`,
        },
        {
          key: "m-cols",
          file: `${B}/models.py`,
          summary: "Add status, cancellation time and reason to Booking",
          add: 3,
          patch: `@@ -41,0 +51,3 @@ class Booking(Base):
+    status = Column(Enum(BookingStatus), nullable=False, default=BookingStatus.CONFIRMED)
+    cancelled_at = Column(DateTime, nullable=True)
+    cancellation_reason = Column(String, nullable=True)`,
        },
        {
          key: "m-rel",
          file: `${B}/models.py`,
          summary: "Link a booking to its refunds",
          add: 1,
          patch: `@@ -44,0 +55,1 @@ class Booking(Base):
+    refunds = relationship("Refund", back_populates="booking", cascade="all, delete-orphan")`,
        },
        {
          key: "m-refund",
          file: `${B}/models.py`,
          summary: "Add Refund model",
          add: 16,
          patch: `@@ -52,0 +67,16 @@ class Booking(Base):
+
+
+class Refund(Base):
+    __tablename__ = "refunds"
+
+    refund_id = Column(Integer, primary_key=True, index=True)
+    booking_id = Column(Integer, ForeignKey("bookings.booking_id"), nullable=False)
+    amount = Column(Float, nullable=False)
+    percentage = Column(Integer, nullable=False)
+    policy_tier = Column(String, nullable=False)
+    issued_at = Column(DateTime, nullable=False, default=datetime.utcnow)
+
+    booking = relationship("Booking", back_populates="refunds")
+
+    def __repr__(self):
+        return f"<Refund {self.refund_id} booking={self.booking_id} {self.amount:.2f}>"`,
        },
        {
          key: "s-status",
          file: `${B}/schemas.py`,
          summary: "Expose status and cancelled_at on BookingOut",
          add: 2,
          patch: `@@ -58,0 +59,2 @@ class BookingOut(BaseModel):
+    status: BookingStatus = BookingStatus.CONFIRMED
+    cancelled_at: Optional[datetime] = None`,
        },
        {
          key: "s-cancel",
          file: `${B}/schemas.py`,
          summary: "Add CancellationRequest",
          add: 4,
          patch: `@@ -71,0 +75,4 @@
+class CancellationRequest(BaseModel):
+    user_id: int
+    name: str
+    reason: Optional[str] = Field(default=None, max_length=280)`,
        },
        {
          key: "s-refund",
          file: `${B}/schemas.py`,
          summary: "Add RefundOut",
          add: 9,
          patch: `@@ -75,0 +83,9 @@
+
+
+class RefundOut(BaseModel):
+    booking_id: int
+    amount: float
+    percentage: int
+    policy_tier: str
+    issued_at: datetime
+    model_config = ConfigDict(from_attributes=True)`,
        },
        {
          key: "seed",
          file: `${B}/seed.py`,
          summary: "Seed existing bookings as confirmed",
          add: 1,
          del: 1,
          patch: `@@ -64 +64 @@ def seed_bookings(db):
-        db.add(Booking(user_id=u.user_id, flight_id=f.flight_id, booking_time=t))
+        db.add(Booking(user_id=u.user_id, flight_id=f.flight_id, booking_time=t, status=BookingStatus.CONFIRMED))`,
        },
      ],
    },
    {
      name: "Booking logic",
      rationale:
        "The existing booking and flight services learn about status, and the cancellation policy arrives as a pure module. After this layer the app still behaves as before for every current endpoint.",
      tests: 44,
      durationMs: 3400,
      atoms: [
        {
          key: "b-import",
          file: `${B}/services/booking.py`,
          summary: "Import BookingStatus",
          add: 1,
          del: 1,
          patch: `@@ -3 +3 @@
-from models import Booking, Flight, User
+from models import Booking, BookingStatus, Flight, User`,
        },
        {
          key: "b-confirm",
          file: `${B}/services/booking.py`,
          summary: "Book new flights as confirmed",
          add: 1,
          patch: `@@ -38,0 +39,1 @@ def book_flight(db, user_id, name, flight_id):
+        status=BookingStatus.CONFIRMED,`,
        },
        {
          key: "b-list",
          file: `${B}/services/booking.py`,
          summary: "Hide cancelled bookings unless asked",
          add: 5,
          del: 2,
          patch: `@@ -61,2 +62,5 @@
-def get_user_bookings(db, user_id):
-    return db.query(Booking).filter(Booking.user_id == user_id).all()
+def get_user_bookings(db, user_id, include_cancelled=False):
+    query = db.query(Booking).filter(Booking.user_id == user_id)
+    if not include_cancelled:
+        query = query.filter(Booking.status == BookingStatus.CONFIRMED)
+    return query.order_by(Booking.booking_time.desc()).all()`,
        },
        {
          key: "b-get",
          file: `${B}/services/booking.py`,
          summary: "Add _get_booking_for_user",
          add: 10,
          patch: `@@ -67,0 +71,10 @@
+
+def _get_booking_for_user(db, user_id, booking_id):
+    booking = (
+        db.query(Booking)
+        .filter(Booking.booking_id == booking_id, Booking.user_id == user_id)
+        .first()
+    )
+    if booking is None:
+        raise LookupError(f"Booking {booking_id} not found for user {user_id}")
+    return booking`,
        },
        {
          key: "f-release",
          file: `${B}/services/flight.py`,
          summary: "Add release_seat",
          add: 8,
          patch: `@@ -40,0 +41,8 @@
+def release_seat(db, flight_id):
+    flight = db.query(Flight).filter(Flight.flight_id == flight_id).with_for_update().first()
+    if flight is None:
+        raise LookupError(f"Flight {flight_id} not found")
+    flight.seats_available = min(flight.seats_available + 1, flight.capacity)
+    db.add(flight)
+    return flight
+`,
        },
        {
          key: "f-order",
          file: `${B}/services/flight.py`,
          summary: "Order flights by departure time",
          add: 2,
          del: 1,
          patch: `@@ -22 +22,2 @@ def list_flights(db):
-    return db.query(Flight).all()
+    flights = db.query(Flight).order_by(Flight.departure_time).all()
+    return [f for f in flights if f.departure_time is not None]`,
        },
        {
          key: "policy",
          file: `${B}/services/policy.py`,
          summary: "Cancellation policy tiers",
          kind: "new-file",
          add: 36,
          patch: `@@ -0,0 +1,36 @@
+"""Cancellation policy: how much of a fare comes back, by notice given."""
+from dataclasses import dataclass
+from datetime import timedelta
+
+
+@dataclass(frozen=True)
+class PolicyTier:
+    name: str
+    min_notice: timedelta
+    percentage: int
+
+
+TIERS = (
+    PolicyTier("full", timedelta(hours=72), 100),
+    PolicyTier("partial", timedelta(hours=24), 50),
+    PolicyTier("none", timedelta(0), 0),
+)
+
+
+def tier_for(notice: timedelta) -> PolicyTier:
+    return next(t for t in TIERS if notice >= t.min_notice)
+
+
+def refund_percentage(departure_time, now):
+    """Return (percentage, tier_name) for a cancellation made at \`now\`."""
+    if departure_time <= now:
+        return 0, "departed"
+    tier = tier_for(departure_time - now)
+    return tier.percentage, tier.name
+
+
+def describe(tier_name: str) -> str:
+    return {
+        "full": "Full refund, 72 hours or more before departure",
+        "partial": "Half refund, 24 to 72 hours before departure",
+    }.get(tier_name, "No refund within 24 hours of departure")`,
        },
      ],
    },
    {
      name: "Cancellation",
      rationale:
        "The new behaviour lives here: quoting and issuing refunds, cancelling a booking exactly once, and recording it in the audit log. BookingOut starts reporting refund totals in the same layer that computes them.",
      tests: 44,
      durationMs: 3900,
      atoms: [
        {
          key: "refund",
          file: `${B}/services/refund.py`,
          summary: "Quote and issue refunds",
          kind: "new-file",
          add: 44,
          excerpt: true,
          patch: `@@ -0,0 +1,44 @@
+from dataclasses import dataclass
+from datetime import datetime
+
+from models import BookingStatus, Refund
+from services.policy import refund_percentage
+
+
+@dataclass(frozen=True)
+class RefundQuote:
+    amount: float
+    percentage: int
+    policy_tier: str
+
+
+def quote_refund(booking, now=None) -> RefundQuote:
+    now = now or datetime.utcnow()
+    if booking.status != BookingStatus.CONFIRMED:
+        return RefundQuote(amount=0.0, percentage=0, policy_tier="not-refundable")
+    percentage, tier = refund_percentage(booking.flight.departure_time, now)
+    amount = round(booking.flight.price * percentage / 100, 2)
+    return RefundQuote(amount=amount, percentage=percentage, policy_tier=tier)
+
+
+def issue_refund(db, booking, quote: RefundQuote) -> Refund:`,
        },
        {
          key: "cancel",
          file: `${B}/services/cancellation.py`,
          summary: "Cancel a booking exactly once",
          kind: "new-file",
          add: 58,
          excerpt: true,
          patch: `@@ -0,0 +1,58 @@
+"""Cancel a booking and refund it according to policy. Safe to call twice."""
+from datetime import datetime
+
+from models import BookingStatus
+from services.audit import record_cancellation
+from services.booking import _get_booking_for_user
+from services.flight import release_seat
+from services.refund import issue_refund, quote_refund
+
+
+class CancellationError(Exception):
+    """Raised when a booking can't be cancelled."""
+
+
+def cancel_booking(db, user_id, booking_id, reason=None, now=None):
+    now = now or datetime.utcnow()
+    booking = _get_booking_for_user(db, user_id, booking_id)
+
+    if booking.status == BookingStatus.CANCELLED:
+        return booking, booking.refunds[-1] if booking.refunds else None
+    if booking.flight.departure_time <= now:
+        raise CancellationError("This flight has already departed")`,
        },
        {
          key: "audit",
          file: `${B}/services/audit.py`,
          summary: "Record cancellations in the audit log",
          kind: "new-file",
          add: 18,
          patch: `@@ -0,0 +1,18 @@
+import json
+import logging
+
+logger = logging.getLogger("galaxium.audit")
+
+
+def record_cancellation(booking, refund, reason):
+    logger.info(
+        json.dumps(
+            {
+                "event": "booking.cancelled",
+                "booking_id": booking.booking_id,
+                "refund": refund.amount if refund else 0,
+                "reason": reason,
+            }
+        )
+    )
+    return True`,
        },
        {
          key: "b-out",
          file: `${B}/services/booking.py`,
          summary: "booking_to_out reports refund_total",
          add: 6,
          del: 2,
          patch: `@@ -84,2 +94,6 @@ def booking_to_out(booking):
-    return BookingOut.model_validate(booking)
-
+    refund_total = sum(r.amount for r in booking.refunds)
+    return BookingOut.model_validate(
+        {**booking.__dict__, "refund_total": round(refund_total, 2)}
+    )
+
+`,
        },
        {
          key: "s-total",
          file: `${B}/schemas.py`,
          summary: "Add refund_total to BookingOut",
          add: 1,
          patch: `@@ -60,0 +62,1 @@ class BookingOut(BaseModel):
+    refund_total: float`,
        },
        {
          key: "svc-init",
          file: `${B}/services/__init__.py`,
          summary: "Export cancellation and refund services",
          add: 3,
          patch: `@@ -4,0 +5,3 @@
+from services.cancellation import CancellationError, cancel_booking
+from services.refund import RefundQuote, quote_refund
+from services.policy import describe as describe_policy`,
        },
        {
          key: "b-quote-import",
          file: `${B}/services/booking.py`,
          summary: "Import quote_refund",
          add: 1,
          patch: `@@ -4,0 +5,1 @@
+from services.refund import quote_refund`,
        },
      ],
    },
    {
      name: "API changes",
      rationale:
        "Cancellation becomes reachable: two REST routes, two MCP tools and a 409 for invalid cancellations. Every route calls the services from Layer 03 and adds no logic of its own.",
      tests: 44,
      durationMs: 4200,
      atoms: [
        {
          key: "srv-import",
          file: `${B}/server.py`,
          summary: "Import cancellation services",
          add: 2,
          del: 1,
          patch: `@@ -18 +18,2 @@
-from services import booking, flight, user
+from services import booking, flight, user
+from services import CancellationError, cancel_booking, quote_refund`,
        },
        {
          key: "srv-cancel",
          file: `${B}/server.py`,
          summary: "POST /bookings/{booking_id}/cancel",
          add: 19,
          patch: `@@ -142,0 +144,19 @@
+@app.post("/bookings/{booking_id}/cancel", response_model=RefundOut, tags=["cancellations"])
+def cancel(booking_id: int, body: CancellationRequest, db: Session = Depends(get_db)):
+    """Cancel a booking and refund it according to the cancellation policy."""
+    user.verify_identity(db, body.user_id, body.name)
+    try:
+        _, refund = cancel_booking(db, body.user_id, booking_id, reason=body.reason)
+    except LookupError as exc:
+        raise HTTPException(status_code=404, detail=str(exc))
+    if refund is None:
+        return RefundOut(
+            booking_id=booking_id,
+            amount=0.0,
+            percentage=0,
+            policy_tier="none",
+            issued_at=datetime.utcnow(),
+        )
+    return refund
+
+`,
        },
        {
          key: "srv-quote",
          file: `${B}/server.py`,
          summary: "GET /bookings/{booking_id}/refund-quote",
          add: 12,
          patch: `@@ -161,0 +164,12 @@
+@app.get("/bookings/{booking_id}/refund-quote", tags=["cancellations"])
+def refund_quote(booking_id: int, user_id: int, db: Session = Depends(get_db)):
+    try:
+        found = booking._get_booking_for_user(db, user_id, booking_id)
+    except LookupError as exc:
+        raise HTTPException(status_code=404, detail=str(exc))
+    quote = quote_refund(found)
+    return {
+        "amount": quote.amount,
+        "percentage": quote.percentage,
+        "policy": describe_policy(quote.policy_tier),
+    }`,
        },
        {
          key: "srv-409",
          file: `${B}/server.py`,
          summary: "Return 409 for invalid cancellations",
          add: 9,
          patch: `@@ -60,0 +62,9 @@
+@app.exception_handler(CancellationError)
+async def cancellation_error(request: Request, exc: CancellationError):
+    return JSONResponse(
+        status_code=409,
+        content={"error": str(exc), "code": "cancellation_not_allowed"},
+    )
+
+
+`,
        },
        {
          key: "mcp-cancel",
          file: `${B}/server.py`,
          summary: "MCP tool: cancel_booking",
          add: 14,
          patch: `@@ -210,0 +224,14 @@
+@mcp.tool()
+def cancel_booking_tool(user_id: int, name: str, booking_id: int, reason: str | None = None):
+    """Cancel a booking and return the refund issued."""
+    db = SessionLocal()
+    try:
+        user.verify_identity(db, user_id, name)
+        _, refund = cancel_booking(db, user_id, booking_id, reason=reason)
+        return {
+            "booking_id": booking_id,
+            "refund": refund.amount if refund else 0.0,
+        }
+    finally:
+        db.close()
+`,
        },
        {
          key: "mcp-quote",
          file: `${B}/server.py`,
          summary: "MCP tool: get_refund_quote",
          add: 10,
          patch: `@@ -224,0 +239,10 @@
+@mcp.tool()
+def get_refund_quote(user_id: int, booking_id: int):
+    """How much a cancellation would refund right now."""
+    db = SessionLocal()
+    try:
+        quote = quote_refund(booking._get_booking_for_user(db, user_id, booking_id))
+        return {"amount": quote.amount, "percentage": quote.percentage}
+    finally:
+        db.close()
+`,
        },
        {
          key: "srv-tags",
          file: `${B}/server.py`,
          summary: "Tag cancellation routes in OpenAPI",
          add: 4,
          del: 1,
          patch: `@@ -31 +31,4 @@
-app = FastAPI(title="Galaxium Travels API", lifespan=lifespan)
+app = FastAPI(
+    title="Galaxium Travels API",
+    lifespan=lifespan,
+    openapi_tags=[{"name": "cancellations", "description": "Cancel bookings and quote refunds"}],`,
        },
        {
          key: "readme",
          file: `${B}/README.md`,
          summary: "Document the cancellation endpoints",
          add: 22,
          excerpt: true,
          patch: `@@ -88,0 +89,22 @@
+### Cancellations
+
+\`POST /bookings/{booking_id}/cancel\` cancels a booking and refunds it:
+
+| Notice before departure | Refund |
+| ----------------------- | ------ |
+| 72 hours or more        | 100%   |
+| 24 to 72 hours          | 50%    |
+| Less than 24 hours      | 0%     |
+
+Cancelling twice returns the original refund; it never refunds twice.`,
        },
      ],
    },
    {
      name: "Tests",
      rationale:
        "Tests for the policy tiers, refunds, idempotent cancellation and both endpoints, plus the two fixtures they share. Kept last so every earlier layer is proven against the suite that already existed.",
      tests: 80,
      durationMs: 7800,
      atoms: [
        {
          key: "fx-booking",
          file: `${B}/tests/conftest.py`,
          summary: "Fixture: confirmed_booking",
          add: 14,
          patch: `@@ -58,0 +59,14 @@
+
+@pytest.fixture
+def confirmed_booking(db_session, sample_user, future_flight):
+    booking = Booking(
+        user_id=sample_user.user_id,
+        flight_id=future_flight.flight_id,
+        booking_time=datetime(2026, 9, 1, 9, 0),
+        status=BookingStatus.CONFIRMED,
+    )
+    db_session.add(booking)
+    db_session.commit()
+    db_session.refresh(booking)
+    return booking
+`,
        },
        {
          key: "fx-now",
          file: `${B}/tests/conftest.py`,
          summary: "Fixture: frozen_now",
          add: 7,
          patch: `@@ -72,0 +74,7 @@
+
+@pytest.fixture
+def frozen_now(future_flight):
+    """A clock 96 hours before the flight departs (full refund tier)."""
+    return future_flight.departure_time - timedelta(hours=96)
+
+`,
        },
        {
          key: "t-policy",
          file: `${B}/tests/test_policy.py`,
          summary: "Policy tier tests",
          kind: "new-file",
          add: 48,
          excerpt: true,
          patch: `@@ -0,0 +1,48 @@
+from datetime import datetime, timedelta
+
+import pytest
+
+from services.policy import refund_percentage, tier_for
+
+DEPARTURE = datetime(2026, 10, 12, 18, 0)
+
+
+@pytest.mark.parametrize(
+    "hours_before, expected",
+    [(96, (100, "full")), (72, (100, "full")), (48, (50, "partial")), (2, (0, "none"))],
+)
+def test_refund_percentage_by_notice(hours_before, expected):
+    assert refund_percentage(DEPARTURE, DEPARTURE - timedelta(hours=hours_before)) == expected`,
        },
        {
          key: "t-refund",
          file: `${B}/tests/test_refund.py`,
          summary: "Refund quote and issue tests",
          kind: "new-file",
          add: 71,
          excerpt: true,
          patch: `@@ -0,0 +1,71 @@
+from services.refund import quote_refund, issue_refund
+
+
+def test_quote_is_full_refund_with_four_days_notice(confirmed_booking, frozen_now):
+    quote = quote_refund(confirmed_booking, now=frozen_now)
+    assert quote.percentage == 100
+    assert quote.amount == confirmed_booking.flight.price
+
+
+def test_issue_refund_creates_one_row(db_session, confirmed_booking, frozen_now):
+    refund = issue_refund(db_session, confirmed_booking, quote_refund(confirmed_booking, now=frozen_now))
+    assert refund.refund_id is not None
+    assert len(confirmed_booking.refunds) == 1`,
        },
        {
          key: "t-cancel",
          file: `${B}/tests/test_cancellation.py`,
          summary: "Cancellation behaviour tests",
          kind: "new-file",
          add: 112,
          excerpt: true,
          patch: `@@ -0,0 +1,112 @@
+import pytest
+
+from models import BookingStatus
+from services.cancellation import CancellationError, cancel_booking
+
+
+def test_cancel_releases_the_seat(db_session, confirmed_booking, frozen_now):
+    seats_before = confirmed_booking.flight.seats_available
+    cancel_booking(db_session, confirmed_booking.user_id, confirmed_booking.booking_id, now=frozen_now)
+    assert confirmed_booking.status == BookingStatus.CANCELLED
+    assert confirmed_booking.flight.seats_available == seats_before + 1
+
+
+def test_cancelling_twice_refunds_once(db_session, confirmed_booking, frozen_now):
+    first = cancel_booking(db_session, confirmed_booking.user_id, confirmed_booking.booking_id, now=frozen_now)
+    second = cancel_booking(db_session, confirmed_booking.user_id, confirmed_booking.booking_id, now=frozen_now)
+    assert first[1].refund_id == second[1].refund_id`,
        },
        {
          key: "t-rest-cancel",
          file: `${B}/tests/test_rest.py`,
          summary: "Cancel endpoint tests",
          add: 58,
          excerpt: true,
          patch: `@@ -214,0 +215,58 @@
+def test_cancel_endpoint_refunds_full_fare(client, confirmed_booking, sample_user):
+    response = client.post(
+        f"/bookings/{confirmed_booking.booking_id}/cancel",
+        json={"user_id": sample_user.user_id, "name": sample_user.name},
+    )
+    assert response.status_code == 200
+    assert response.json()["percentage"] == 100
+
+
+def test_cancel_endpoint_rejects_departed_flight(client, departed_booking, sample_user):
+    response = client.post(
+        f"/bookings/{departed_booking.booking_id}/cancel",
+        json={"user_id": sample_user.user_id, "name": sample_user.name},
+    )
+    assert response.status_code == 409`,
        },
        {
          key: "t-rest-quote",
          file: `${B}/tests/test_rest.py`,
          summary: "Refund quote endpoint test",
          add: 19,
          patch: `@@ -272,0 +274,19 @@
+def test_refund_quote_matches_policy(client, confirmed_booking, sample_user):
+    response = client.get(
+        f"/bookings/{confirmed_booking.booking_id}/refund-quote",
+        params={"user_id": sample_user.user_id},
+    )
+    assert response.status_code == 200
+    body = response.json()
+    assert body["percentage"] in (0, 50, 100)
+    assert body["policy"]
+
+
+def test_refund_quote_404_for_other_users_booking(client, confirmed_booking):
+    response = client.get(
+        f"/bookings/{confirmed_booking.booking_id}/refund-quote",
+        params={"user_id": 9999},
+    )
+    assert response.status_code == 404
+
+`,
        },
      ],
    },
  ],
  dependencies: [
    { from: "b-confirm", to: "m-enum", symbol: "BookingStatus", kind: "model" },
    { from: "b-list", to: "m-enum", symbol: "BookingStatus.CONFIRMED", kind: "model" },
    { from: "refund", to: "m-refund", symbol: "Refund", kind: "import" },
    { from: "refund", to: "policy", symbol: "refund_percentage", kind: "import" },
    { from: "cancel", to: "b-get", symbol: "_get_booking_for_user", kind: "import" },
    { from: "cancel", to: "f-release", symbol: "release_seat", kind: "import" },
    { from: "cancel", to: "refund", symbol: "quote_refund", kind: "import" },
    { from: "b-out", to: "m-rel", symbol: "Booking.refunds", kind: "model" },
    {
      from: "s-total",
      to: "b-out",
      symbol: "BookingOut.refund_total",
      kind: "runtime",
      discovered: true,
    },
    { from: "srv-cancel", to: "cancel", symbol: "cancel_booking", kind: "call" },
    { from: "srv-quote", to: "refund", symbol: "quote_refund", kind: "call" },
    { from: "srv-cancel", to: "s-cancel", symbol: "CancellationRequest", kind: "model" },
  ],
  rounds: [
    {
      layers: 5,
      failures: [
        {
          layer: 2,
          test: "tests/test_rest.py::test_get_user_bookings",
          message:
            "pydantic_core.ValidationError: 1 validation error for BookingOut\nrefund_total\n  Field required [type=missing, input_value={...}, input_type=dict]",
          failed: 1,
        },
      ],
    },
    { layers: 5 },
  ],
  repairs: [
    {
      afterRound: 0,
      atom: "s-total",
      from: 2,
      to: 3,
      reason:
        "BookingOut.refund_total is required, and only booking_to_out in Layer 03 fills it. The existing bookings test fails at Layer 02 without it.",
    },
  ],
};
