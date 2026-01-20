import React from 'react';

const AddCategoryModal = ({ showId, onSubmit, category, setCategory, loading }) => {
  return (
    <div className="modal fade" id={showId} tabIndex={-1} aria-hidden="true">
      <div className="modal-dialog modal-md modal-dialog-centered">
        <div className="modal-content radius-16 bg-base">
          <div className="modal-header py-16 px-24 border-bottom">
            <h5 className="modal-title">Add New Category</h5>
            <button type="button" className="btn-close" data-bs-dismiss="modal" />
          </div>
          <div className="modal-body p-24">
            <form onSubmit={onSubmit}>
              <div className="mb-20">
                <label className="form-label text-sm mb-8">Category Name</label>
                <input
                  type="text"
                  className="form-control radius-8"
                  placeholder="Enter Category Name"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                />
              </div>
              <div className="d-flex align-items-center justify-content-center gap-3 mt-24">
                <button type="reset" className="btn btn-outline-danger px-50 py-11 radius-8">Reset</button>
                <button type="submit" className="btn btn-primary px-50 py-12 radius-8" data-bs-dismiss="modal" disabled={loading}>
                  {loading ? "Saving..." : "Save Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddCategoryModal;
