class AppError(Exception):
    status_code = 400
    code = "application_error"


class DuplicateItemError(AppError):
    status_code = 409
    code = "duplicate_item"


class DataValidationError(AppError):
    status_code = 422
    code = "data_validation_error"


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"
