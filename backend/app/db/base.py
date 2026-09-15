from sqlalchemy.orm import DeclarativeBase

# Column names, most to least specific, used to render a mapped row as a short
# human label (see ``Base.__str__``). SQLAdmin uses ``str(obj)`` for every
# relationship cell, detail link, and foreign-key dropdown option, so a good
# label here is what makes the admin readable.
REPRESENTATIVE_COLUMN_NAMES: tuple[str, ...] = (
    "canonical_name",
    "name",
    "email",
    "title",
    "code",
    "value",
    "normalized_id",
    "ticket_id",
    "rfc_ref",
    "source_file",
)


class Base(DeclarativeBase):
    def __str__(self) -> str:
        try:
            hierarchy_id = getattr(self, "hierarchy_id", None)
            name = getattr(self, "name", None)
            if hierarchy_id and name:
                return f"{hierarchy_id} {name}"
            for column_name in REPRESENTATIVE_COLUMN_NAMES:
                value = getattr(self, column_name, None)
                if value:
                    return str(value)
            identifier = getattr(self, "id", None)
            if identifier is not None:
                return f"{type(self).__name__} #{identifier}"
        except Exception:  # detached/expired instance -- fall through to the class name
            pass
        return type(self).__name__
