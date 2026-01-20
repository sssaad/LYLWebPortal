import React from 'react';

const AddSubjectModal = ({ showId, onSubmit, subject, setSubject, category, setCategory, categories, loading }) => {
  return (
    <div className="modal fade" id={showId} tabIndex={-1} aria-hidden="true">
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content radius-16 bg-base">
          <div className="modal-header py-16 px-24 border-bottom">
            <h5 className="modal-title">Add New Subject</h5>
            <button type="button" className="btn-close" data-bs-dismiss="modal" />
          </div>
          <div className="modal-body p-24">
            <form onSubmit={onSubmit}>
              <div className="row">
                <div className="col-12 mb-20">
                  <label className="form-label text-sm mb-8">Subject Name</label>
                  <input
                    type="text"
                    className="form-control radius-8"
                    placeholder="Enter Subject Name"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                  />
                </div>
                <div className="col-12 mb-20">
                  <label className="form-label text-sm mb-8">Subject Category</label>
                  <select
                    className="form-control radius-8"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.categoryname}</option>
                    ))}
                  </select>
                </div>
                <div className="col-12 d-flex align-items-center justify-content-center gap-3 mt-24">
                  <button type="reset" className="btn btn-outline-danger px-50 py-11 radius-8">Reset</button>
                  <button type="submit" className="btn btn-primary px-50 py-12 radius-8" data-bs-dismiss="modal" disabled={loading}>
                    {loading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddSubjectModal;
