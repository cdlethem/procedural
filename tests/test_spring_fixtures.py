import copy,json,unittest
from pathlib import Path
from tools.check_spring_fixtures import validate,reference
ROOT=Path(__file__).resolve().parents[1]
class SpringFixtureTests(unittest.TestCase):
 def setUp(self):
  self.op=json.loads((ROOT/'catalog/operations/target-springs-2d.json').read_text())
  self.fixture=json.loads((ROOT/'fixtures/operations/target-springs-2d.json').read_text())
 def case(self,name):return next(c for c in self.fixture['cases'] if c['id']==name)
 def errors(self):return validate(ROOT,'spring',self.op,self.fixture)
 def test_frozen_vectors(self):self.assertEqual(self.errors(),[])
 def test_detect_position_error(self):
  self.case('source-shaped-first-step')['output']['bodies'][0]['position'][0]+=1
  self.assertTrue(self.errors())
 def test_detect_coefficient_mutation(self):
  self.case('source-shaped-first-step')['output']['bodies'][0]['retention']=.9
  self.assertTrue(self.errors())
 def test_detect_signed_zero_output(self):
  self.case('canonical-all-input-zeros')['output']['bodies'][0]['velocity'][0]=-0.0
  self.assertTrue(self.errors())
 def test_detect_wrong_arithmetic_precedence(self):
  self.case('x-position-before-y-delta')['error_details'].update(axis='y',stage='delta')
  self.assertTrue(self.errors())
 def test_detect_late_static_error_masking(self):
  c=self.case('late-invalid-target-beats-body-zero-overflow');c['error']='SPRING_ARITHMETIC_INVALID';c['error_details']={'bodyIndex':0,'axis':'x','stage':'delta'}
  self.assertTrue(self.errors())
 def test_detect_broken_sequence_even_with_correct_new_output(self):
  c=self.case('changing-target-12-05');c['input']['state']['bodies'][0]['position'][0]+=1
  c['output']=reference(c['input'])['output']
  self.assertTrue(any('not chained' in e for e in self.errors()))
 def test_detect_wrong_restored_state(self):
  c=self.case('restore-mid-sequence');c['input']['targets'][0][0]+=1;c['output']=reference(c['input'])['output']
  self.assertTrue(any('restored state' in e for e in self.errors()))
 def test_no_fma_witness(self):
  c=self.case('no-fma');c['output']['bodies'][0]['position'][0]=2.220446049250313
  self.assertTrue(self.errors())
 def test_no_retention_is_not_no_position_step(self):
  c=self.case('zero-retention');c['output']['bodies'][0]['position']=[0.0,0.0]
  self.assertTrue(self.errors())
if __name__=='__main__':unittest.main()
