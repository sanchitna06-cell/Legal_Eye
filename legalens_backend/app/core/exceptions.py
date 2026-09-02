class InvalidEventPayloadError(Exception):
    def __init__(
        self,
        event_name: str,
        expected: str,
        received: str
    ):
        self.event_name = event_name
        self.expected = expected
        self.received = received

        super().__init__(
            f"Invalid payload for {event_name}. "
            f"Expected {expected}, received {received}"
        )